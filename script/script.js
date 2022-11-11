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
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            zoomSnap: 5,
        }).addTo(this.#map); // Create map layer and append it to map instance

        var latlngs = [[37, -109.05], [41, -109.03], [41, -102.05], [37, -102.04]];

        var polygon = L.polygon(latlngs, { color: 'red' }).addTo(this.#map);

        // zoom the map to the polygon
        map.fitBounds(polygon.getBounds());

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

    _validateInput(...inputs) {
        return inputs.every(input => Number.isFinite(parseInt(input)));
    }

    _checkPositive(...inputs) {
        return inputs.every(input => parseInt(input) > 0);
    }

    _newWorkout(e) { // Creation of new workout
        e.preventDefault();

        const type = inputType.value;

        const distance = inputDistance.value;
        const duration = inputDuration.value;

        const { lat, lng } = this.#mapEvent.latlng;

        let workout;

        // Create workout based on selected type from user
        if (type === 'running') {
            const cadence = parseInt(inputCadence.value);

            if (!this._validateInput(distance, duration, cadence) || !this._checkPositive(distance, duration, cadence))
                return this._errorMessage('Inputs have to be positive numbers!');

            workout = new Running([lat, lng], distance, duration, cadence);
        }

        if (type === 'cycling') {
            const elevation = parseInt(inputElevation.value);

            if (!this._validateInput(distance, duration, elevation) || !this._checkPositive(distance, duration))
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

    _renderWorkout(workout, element) {
        let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details__distance">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details__duration">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>`

        if (workout.type === 'running') {
            html += `
            <div class="workout__details">
                <span class="workout__icon__icon">⚡️</span>
                <span class="workout__value">${workout.pace.toFixed(1)}</span>
                <span class="workout__unit">min/km</span>
            </div>
            <div class="workout__details__cadence">
                <span class="workout__icon">🦶🏼</span>
                <span class="workout__value">${workout.cadence}</span>
                <span class="workout__unit">spm</span>
            </div>
            <a href="#" data-id="${workout.id}" class="workout__delete"> DELETE </a>
            <a href="#" class="workout__edit"> EDIT </a>
        </li>`;
        }

        if (workout.type === 'cycling') {
            html += `<div class="workout__details__speed">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details__elevation">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevation}</span>
            <span class="workout__unit">m</span>
          </div>
          <a href="#" data-id="${workout.id}" class="workout__delete"> DELETE </a>
          <a href="#" class="workout__edit"> EDIT </a>
        </li>`
        }
        if (this.#currentAction === 'editing') {
            element.insertAdjacentHTML('afterend', html);
        }
        else form.insertAdjacentHTML('afterend', html);
    }
    _containerListen(e) { // When clicked on container either remove workout(When clicked on Delete) or reposition to the workout on map(When clicked on rest of workout class)
        const trg = e.target;

        if (trg.classList[0] === 'workout__delete') {
            this._deleteWorkout(trg)
        }

        const workoutEl = trg.closest('.workout');

        if (!workoutEl) return;

        const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);

        if (trg.classList[0] === 'workout__edit') {
            return this._editWorkout(workout, trg)
        }

        if (!workout) return;

        this.#map.setView(workout.coords, this.#mapZoomL, {
            animate: true,
            pan: {
                duration: 1
            },
        });

    }

    _editWorkout(workout, trg) {

        this.#currentAction = 'editing';

        inputDistance.value = workout.distance;
        inputDuration.value = workout.duration;
        inputCadence.value = workout.cadence;
        inputElevation.value = workout.elevation;

        this._showForm();

        discardChangesBtn.addEventListener('click', () => {
            this._hideForm();
        }, {
            once: true,
        });

        saveChangesBtn.addEventListener('click', (e) => {

            if (this._validateInput(inputDistance.value, inputDuration.value) && this._checkPositive(inputDistance.value, inputDuration.value)) {
                workout.distance = inputDistance.value;
                workout.duration = inputDuration.value;
            } else return this._errorMessage('Data must be positive 1');

            if (workout.type === 'running') {
                if (this._validateInput(inputCadence.value) && this._checkPositive(inputCadence.value)) workout.cadence = inputCadence.value;
                else return this._errorMessage('Data must be positive 2');
            }

            if (workout.type === 'cycling') {
                if (this._validateInput(inputElevation.value) && this._checkPositive(inputElevation.value)) workout.elevation = inputElevation.value;
                else return this._errorMessage('Data must be positive 3');
            }

            this._renderWorkout(workout, trg.parentElement);
            this._setLocalStorage();
            this._hideForm();

            trg.parentElement.remove();
        }, {
            once: true,
        });

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
        if (this.#workouts.length === 0) return this._errorMessage('No added workouts to recenter around');

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


