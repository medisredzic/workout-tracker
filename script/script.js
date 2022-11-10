'use strict';


const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteAllBtn = document.querySelector('.deleteAll__btn');

const errorMessage = document.querySelector('.errorMessage');

class Workout {

    date = new Date();
    clicks = 0;

    constructor(coords, distance, duration, id) {
        this.coords = coords;
        this.distance = distance;
        this.duration = duration;

        if (!id) this.id = Date.now() + ''.slice(-10);
        else this.id = id

    }

    setDescription() {
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

    constructor() {
        this._getPosition();

        this._getLocalStorage();

        form.addEventListener('submit', this._newWorkout.bind(this));
        inputType.addEventListener('change', this._toggleElevationField);
        containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

        deleteAllBtn.addEventListener('click', this._deleteAllWorkouts.bind(this));

    }

    _getPosition() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), this._errorMessage('Could not get your position!'));
        };
    }

    _loadMap(position) {
        const { latitude } = position.coords;
        const { longitude } = position.coords;

        const cords = [latitude, longitude];

        this.#map = L.map('map').setView(cords, this.#mapZoomL);

        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.#map);

        // Handling clicks on map
        this.#map.on('click', this._showForm.bind(this));

        this.#workouts.forEach(work => {
            this._renderWorkoutMarker(work);
        });
    }

    _showForm(mapE) {
        form.classList.remove('hidden');
        inputDistance.focus();
        this.#mapEvent = mapE;
    }

    _hideForm() {
        // Empty inputs
        inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
        form.style.display = 'none';
        form.classList.add('hidden');
        setTimeout(() => form.style.display = 'grid', 1000);
    }

    _toggleElevationField() {
        inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
        inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    }

    _newWorkout(e) {
        e.preventDefault();

        const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));

        const allPositive = (...inputs) => inputs.every(inp => inp > 0);

        // getting data from a form

        const type = inputType.value;

        const distance = parseInt(inputDistance.value);
        const duration = parseInt(inputDuration.value);

        const { lat, lng } = this.#mapEvent.latlng;

        let workout;

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
        this.#workouts.push(workout)

        this._renderWorkoutMarker(workout);

        this._renderWorkout(workout);

        this._hideForm();

        // Local storage

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

    _renderWorkout(workout) {
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
        </li>`
        }

        form.insertAdjacentHTML('afterend', html);
    }

    _moveToPopup(e) {
        const trg = e.target;

        if (trg.classList[0] === 'workout__delete') {
            this._deleteWorkout(trg)
        }

        const workoutEl = e.target.closest('.workout');

        if (!workoutEl) return;

        const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);

        if (!workout) return;

        this.#map.setView(workout.coords, this.#mapZoomL, {
            animate: true,
            pan: {
                duration: 1
            },
        });

    }

    _setLocalStorage() {
        localStorage.setItem('workouts', JSON.stringify(this.#workouts));
    }

    _getLocalStorage() {
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

    _deleteWorkout(e) {
        if (!e) return;

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

    reset() {
        localStorage.removeItem('workouts');
        location.reload();
    }

}

const app = new App();


