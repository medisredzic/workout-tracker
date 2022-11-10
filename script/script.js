'use strict';


// Get DOM elements
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteAllBtn = document.querySelector('.deleteAll__btn');
const recenterMapBtn = document.querySelector('.recenterMap__btn');
const errorMessage = document.querySelector('.errorMessage');

const saveChangesBtn = document.querySelector('.saveChanges__btn');
const discardChangesBtn = document.querySelector('.discardChanges__btn');

// Workout class that serves as parent to different workout types
class Workout {

    date = new Date();
    clicks = 0;

    constructor(coords, distance, duration, id) {
        this.coords = coords;
        this.distance = distance;
        this.duration = duration;

        if (!id) this.id = Date.now() + ''.slice(-10); // If data is fetched from storage use ID that is defined there, if not create new ID
        else this.id = id

    }

    setDescription() { // Create description of exercise(Simple), TODO: Add GeoLocation of workout(eg. Running in Barcelona, Spain)
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
    }

    click() {
        this.clicks += 1;
    }
}

class Running extends Workout {
    type = 'running';

    constructor(coords, distance, duration, cadence, id) {
        super(coords, distance, duration, id);
        this.cadence = cadence;

        this.calcPace();

        this.setDescription();
    }

    calcPace() {
        this.pace = this.duration / this.distance;
        return this.pace;
    }
}

class Cycling extends Workout {
    type = 'cycling';

    constructor(coords, distance, duration, elevation, id) {
        super(coords, distance, duration, id);
        this.elevation = elevation;

        this.calcSpeed();

        this.setDescription();
    }

    calcSpeed() {

        this.speed = this.distance / (this.duration / 60)
        return this.speed;
    }
}

///////////////////////////////////////
/// Aplication Architecture
class App {
    #map;
    #mapEvent;
    #workouts = [];
    #mapZoomL = 13;
    #allMarkers = [];
    #currentAction = 'creating';

    constructor() {
        this._getPosition(); // Get position and check if user allowed access

        this._getLocalStorage(); // Load data from LocalStorage

        form.addEventListener('submit', this._newWorkout.bind(this)); // Event listener to submit data when Enter is pressed
        inputType.addEventListener('change', this._toggleElevationField); // Event listener to shift between different workouts and change their input fields respectively
        containerWorkouts.addEventListener('click', this._containerListen.bind(this)); // Event listener to remove input form after Workout has been submitted

        deleteAllBtn.addEventListener('click', this._deleteAllWorkouts.bind(this)); // Delete all workouts

        recenterMapBtn.addEventListener('click', this._recenterMap.bind(this)); // Recenter map to view all workouts at once

    }

    _getPosition() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () => {
                this._errorMessage('Could not get your position!')
            });
        };
    }

    _loadMap(position) {
        const { latitude } = position.coords; // Lat and lng gotten from _getPosition()
        const { longitude } = position.coords;

        const cords = [latitude, longitude];

        this.#map = L.map('map').setView(cords, this.#mapZoomL); // Create map instance

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.#map); // Create map layer and append it to map instance

        // Handle clicks to open input form
        this.#map.on('click', this._showForm.bind(this));

        this.#workouts.forEach(work => {
            this._renderWorkoutMarker(work);
        });
    }

    _showForm(mapE) { // Show input form in container
        if (this.#currentAction === 'editing') {
            saveChangesBtn.hidden = false;
            discardChangesBtn.hidden = false;
            inputType.disabled = true;
        }
        form.classList.remove('hidden');
        inputDistance.focus();
        this.#mapEvent = mapE;
    }

    _hideForm() { // Hide input form in container
        if (this.#currentAction === 'editing') {
            saveChangesBtn.hidden = true;
            discardChangesBtn.hidden = true;
            this.#currentAction = 'creating';
        }
        inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
        form.style.display = 'none';
        form.classList.add('hidden');
        setTimeout(() => form.style.display = 'grid', 1000);
    }

    _toggleElevationField() { // Switch between cadence(running) and elevation(cycling) input options
        inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
        inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    }

    _newWorkout(e) { // Creation of new workout
        e.preventDefault();

        // Validate inputs
        const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
        const allPositive = (...inputs) => inputs.every(inp => inp > 0);

        const type = inputType.value;

        const distance = parseInt(inputDistance.value);
        const duration = parseInt(inputDuration.value);

        const { lat, lng } = this.#mapEvent.latlng;

        let workout;

        // Create workout based on selected type from user
        if (type === 'running') {
            const cadence = parseInt(inputCadence.value);

            if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence))
                return this._errorMessage('Inputs have to be positive numbers!');

            workout = new Running([lat, lng], distance, duration, cadence);
        }

        if (type === 'cycling') {
            const elevation = parseInt(inputElevation.value);

            if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration))
                return this._errorMessage('Inputs have to be positive numbers!');

            workout = new Cycling([lat, lng], distance, duration, elevation);
        }
        // Add newly created workout to preexisting array
        this.#workouts.push(workout)

        // Create workout marker and popup
        this._renderWorkoutMarker(workout);

        // Add workout to DOM -> to workout container
        this._renderWorkout(workout);

        // Hide input form
        this._hideForm();

        // Override storage with new workout(plus the old ones)
        this._setLocalStorage();
    }

    _renderWorkoutMarker(workout) {
        const mark = L.marker(workout.coords).addTo(this.#map)
            .bindPopup(
                L.popup({
                    maxWidth: 250,
                    minWidth: 100,
                    autoClose: false,
                    closeOnClick: false,
                    className: `${workout.type}-popup`
                })
            )
            .setPopupContent(`${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`)
            .openPopup();

        this.#allMarkers.push(mark);
    }

    _renderWorkout(workout, edit) {
        let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>`

        if (workout.type === 'running') {
            html += `
            <div class="workout__details">
                <span class="workout__icon">⚡️</span>
                <span class="workout__value">${workout.pace.toFixed(1)}</span>
                <span class="workout__unit">min/km</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon">🦶🏼</span>
                <span class="workout__value">${workout.cadence}</span>
                <span class="workout__unit">spm</span>
            </div>
            <a href="#" data-id="${workout.id}" class="workout__delete"> DELETE </a>
            <a href="#" class="workout__edit"> EDIT </a>
        </li>`;
        }

        if (workout.type === 'cycling') {
            html += `<div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevation}</span>
            <span class="workout__unit">m</span>
          </div>
          <a href="#" data-id="${workout.id}" class="workout__delete"> DELETE </a>
          <a href="#" class="workout__edit"> EDIT </a>
        </li>`
        }

        form.insertAdjacentHTML('afterend', html);
    }
    _containerListen(e) { // When clicked on container either remove workout(When clicked on Delete) or reposition to the workout on map(When clicked on rest of workout class)
        const trg = e.target;

        if (trg.classList[0] === 'workout__delete') {
            this._deleteWorkout(trg)
        }


        const workoutEl = e.target.closest('.workout');

        if (!workoutEl) return;

        const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);

        if (trg.classList[0] === 'workout__edit') {
            return this._editWorkout(workout)
        }

        if (!workout) return;

        this.#map.setView(workout.coords, this.#mapZoomL, {
            animate: true,
            pan: {
                duration: 1
            },
        });

    }

    _editWorkout(workout) {

        const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(parseInt(inp)));
        const allPositive = (...inputs) => inputs.every(inp => parseInt(inp) > 0);

        this.#currentAction = 'editing';

        inputDistance.value = workout.distance;
        inputDuration.value = workout.duration;
        inputCadence.value = workout.cadence;
        inputElevation.value = workout.elevation;

        this._showForm();

        discardChangesBtn.addEventListener('click', () => {
            this._hideForm();
        });

        saveChangesBtn.addEventListener('click', (e) => {

            if (validInputs(inputDistance.value, inputDuration.value) && allPositive(inputDistance.value, inputDuration.value)) {
                workout.distance = inputDistance.value;
                workout.duration = inputDuration.value;
            } else return this._errorMessage('Data must be positive');
            if (workout.type === 'running') {
                if (validInputs(inputCadence.value) && allPositive(inputCadence.value)) workout.cadence = inputCadence.value;
                else return this._errorMessage('Data must be positive');
            }
            if (workout.type === 'cycling') {
                if (validInputs(inputElevation.value) && allPositive(inputElevation.value)) workout.elevation = inputElevation.value;
                else return this._errorMessage('Data must be positive');
            }
            this._updateContainer(workout)
            this._setLocalStorage();
            this._hideForm();
        });

    }

    _updateContainer(workout) {
        location.reload();
    }

    _setLocalStorage() {
        localStorage.setItem('workouts', JSON.stringify(this.#workouts));
    }

    _getLocalStorage() { // Load data from LocalStorage and create new instances of workouts
        const data = JSON.parse(localStorage.getItem('workouts'));

        if (!data) return;

        data.forEach(work => {

            let workout;

            if (work.type === 'running') {
                workout = new Running(work.coords, work.distance, work.duration, work.cadence, work.id);
            }

            if (work.type === 'cycling') {
                workout = new Cycling(work.coords, work.distance, work.duration, work.elevation, work.id);
            }

            this.#workouts.push(workout)

            this._renderWorkout(work);
        });

    }

    _deleteWorkout(e) { // Delete workouts, remove markers, remove DOM elements and update LocalStorage
        if (!e) return;
        if (this.#currentAction === 'editing') return this._errorMessage('Can not delete while editing!');

        for (const [i, n] of this.#workouts.entries()) {
            if (n.id === e.dataset.id) {
                this._removeMarker(n.coords)
                this.#workouts.splice(i, i + 1)
                e.parentElement.remove();
            }
        }

        localStorage.setItem('workouts', JSON.stringify(this.#workouts));

    }

    _removeMarker(coords) {
        for (const n of this.#allMarkers) {
            if (coords[0] === n._latlng.lat && coords[1] === n._latlng.lng) {
                this.#map.removeLayer(n);
            }
        }
    }

    _deleteAllWorkouts() {
        const getNodes = document.querySelectorAll('.workout__delete');
        for (const node of getNodes) {
            this._deleteWorkout(node);
        }
    }

    _errorMessage(msg) {
        errorMessage.textContent = msg;
        errorMessage.hidden = false;

        setTimeout(() => {
            errorMessage.textContent = '';
            errorMessage.hidden = true;
        }, 5000)
    }

    _recenterMap() { // Recenter the map so all workouts can be seen.
        if (this.#workouts.length === 0) return;

        let tmp = []

        for (const n of this.#workouts) {
            tmp.push(n.coords)
        }

        this.#map.fitBounds(tmp);
    }

    reset() { // Delete everything from localstorage and reload the page.
        localStorage.removeItem('workouts');
        location.reload();
    }

}

const app = new App();


