document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    const STATE = {
        exercises: [],
        trainings: [],
        tempTrainingExercises: [],
        currentTrainingId: null,
        currentDrawings: [],
        pickerContext: 'create' // 'create' or 'edit'
    };

    // Firebase references
    const db = window.db;
    const { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, orderBy } = window.firebaseMethods;

    // Collections
    const exercisesCol = collection(db, "trainer_exercises");
    const trainingsCol = collection(db, "trainer_trainings");

    // --- DOM Elements ---
    const navLinks = document.querySelectorAll('.nav-links li');
    const sections = document.querySelectorAll('main > section');

    // Sidebar
    const sidebar = document.getElementById('sidebar');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');

    // Exercises
    const exercisesListEl = document.getElementById('exercises-list');
    const btnAddExercise = document.getElementById('btn-add-exercise');
    const modalExercise = document.getElementById('modal-exercise');
    const formExercise = document.getElementById('form-exercise');

    // Canvas Elements
    const canvas = document.getElementById('exercise-canvas');
    const ctx = canvas.getContext('2d');
    const btnClearCanvas = document.getElementById('btn-clear-canvas');
    const btnAddStep = document.getElementById('btn-add-step');
    const drawingFramesListEl = document.getElementById('drawing-frames-list');
    const colorButtons = document.querySelectorAll('.btn-tool[data-color]');

    // Trainings
    const trainingsListEl = document.getElementById('trainings-list');
    const btnCreateTraining = document.getElementById('btn-create-training');
    const modalTraining = document.getElementById('modal-training');
    const formTraining = document.getElementById('form-training');
    const btnOpenPicker = document.getElementById('btn-open-exercise-picker');
    const selectedExercisesListEl = document.getElementById('selected-exercises-list');

    // Picker
    const modalPicker = document.getElementById('modal-picker');
    const pickerListEl = document.getElementById('picker-list');

    // Detail View
    const btnBackTrainings = document.getElementById('btn-back-trainings');
    const detailTimelineEl = document.getElementById('detail-timeline');
    const btnDetailAddExercise = document.getElementById('btn-detail-add-exercise');

    // --- Sidebar Toggle ---
    btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // --- Navigation Logic ---
    const navigateTo = (sectionName) => {
        navLinks.forEach(l => l.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active-section'));

        let link = document.querySelector(`.nav-links li[data-section="${sectionName}"]`);
        if (link) link.classList.add('active');

        const sectionId = sectionName === 'training-detail' ? 'training-detail-section' : sectionName + '-section';
        document.getElementById(sectionId).classList.add('active-section');
    };

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const section = link.getAttribute('data-section');
            navigateTo(section);
        });
    });

    btnBackTrainings.addEventListener('click', () => {
        navigateTo('trainings');
    });

    // --- Modal Logic ---
    const openModal = (modal) => modal.style.display = 'flex';
    const closeModal = (modal) => modal.style.display = 'none';

    document.querySelectorAll('.close-modal, .close-modal-btn, .close-modal-picker').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal);
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });

    // --- Canvas & Multi-Drawing Logic ---
    let isDrawing = false;
    let currentColor = '#000000';

    const setupCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = currentColor;
    };

    btnAddExercise.addEventListener('click', () => {
        formExercise.reset();
        STATE.currentDrawings = []; // Reset frames
        renderDrawingFrames();
        clearCanvas();
        openModal(modalExercise);
        setTimeout(setupCanvas, 100);
    });

    const startDrawing = (e) => {
        isDrawing = true;
        draw(e);
    };

    const stopDrawing = () => {
        isDrawing = false;
        ctx.beginPath();
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
    canvas.addEventListener('touchend', stopDrawing);

    colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            colorButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentColor = btn.getAttribute('data-color');
            ctx.strokeStyle = currentColor;
        });
    });

    const clearCanvas = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    btnClearCanvas.addEventListener('click', clearCanvas);

    const isCanvasBlank = (canvas) => {
        const blank = document.createElement('canvas');
        blank.width = canvas.width;
        blank.height = canvas.height;
        return canvas.toDataURL() === blank.toDataURL();
    };

    btnAddStep.addEventListener('click', () => {
        if (isCanvasBlank(canvas)) {
            alert("Dibuja algo antes de añadir un paso.");
            return;
        }

        const dataUrl = canvas.toDataURL();
        STATE.currentDrawings.push(dataUrl);
        renderDrawingFrames();
    });

    const renderDrawingFrames = () => {
        drawingFramesListEl.innerHTML = '';
        STATE.currentDrawings.forEach((imgSrc, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'frame-thumb';
            thumb.innerHTML = `<img src="${imgSrc}">`;
            thumb.addEventListener('click', () => {
                // For now just Visual Feedback
                // Could load back into canvas in future
            });
            drawingFramesListEl.appendChild(thumb);
        });
    };

    // --- Firebase Subscriptions ---

    const qExercises = query(exercisesCol, orderBy("title"));
    onSnapshot(qExercises, (snapshot) => {
        STATE.exercises = [];
        snapshot.forEach((doc) => {
            STATE.exercises.push({ id: doc.id, ...doc.data() });
        });
        renderExercises();
    }, (error) => console.error("Error fetching exercises:", error));

    const qTrainings = query(trainingsCol, orderBy("date", "desc"));
    onSnapshot(qTrainings, (snapshot) => {
        STATE.trainings = [];
        snapshot.forEach((doc) => {
            STATE.trainings.push({ id: doc.id, ...doc.data() });
        });
        renderTrainings();

        if (STATE.currentTrainingId) {
            const training = STATE.trainings.find(t => t.id === STATE.currentTrainingId);
            if (training) renderTrainingDetail(training);
        }
    }, (error) => console.error("Error fetching trainings:", error));

    // --- Exercises Logic ---

    formExercise.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ageCheckboxes = document.querySelectorAll('input[name="ex-age"]:checked');
        const selectedAges = Array.from(ageCheckboxes).map(cb => cb.value);
        const typeSelect = document.getElementById('ex-type');
        const selectedTypes = Array.from(typeSelect.selectedOptions).map(opt => opt.value);

        if (!isCanvasBlank(canvas)) {
            STATE.currentDrawings.push(canvas.toDataURL());
        }

        const newExercise = {
            title: document.getElementById('ex-title').value,
            description: document.getElementById('ex-description').value,
            image: document.getElementById('ex-image').value,
            drawings: STATE.currentDrawings,
            drawing: STATE.currentDrawings.length > 0 ? STATE.currentDrawings[0] : null,
            ages: selectedAges,
            types: selectedTypes,
            duration: document.getElementById('ex-duration').value,
            variants: document.getElementById('ex-variants').value,
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(exercisesCol, newExercise);
            closeModal(modalExercise);
        } catch (e) {
            console.error("Error adding exercise: ", e);
            alert("Error al guardar el ejercicio.");
        }
    });

    const renderExercises = () => {
        exercisesListEl.innerHTML = '';
        if (STATE.exercises.length === 0) {
            exercisesListEl.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Cargando o sin ejercicios...</p>';
            return;
        }

        STATE.exercises.forEach(ex => {
            const card = document.createElement('div');
            card.className = 'card';

            const agesHtml = ex.ages ? ex.ages.map(age => `<span class="tag">${age}</span>`).join('') : '';
            const typesHtml = ex.types ? ex.types.map(type => `<span class="tag primary">${type}</span>`).join('') : '';

            let imgHtml = '';

            if (ex.drawings && ex.drawings.length > 0) {
                const framesIndicator = ex.drawings.length > 1 ? `<span style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.7); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem;">+${ex.drawings.length - 1} pasos</span>` : '';

                imgHtml = `<div style="position:relative; margin-bottom:10px; border:1px solid #333; border-radius:8px; overflow:hidden; background-image: url('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Basketball_court_half_court.svg/800px-Basketball_court_half_court.svg.png'); background-size: cover; background-position: center;">
                    <img src="${ex.drawings[0]}" style="width:100%; display:block;" alt="Esquema táctico">
                    ${framesIndicator}
                </div>`;
            } else if (ex.drawing) {
                imgHtml = `<div style="margin-bottom:10px; border:1px solid #333; border-radius:8px; overflow:hidden; background-image: url('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Basketball_court_half_court.svg/800px-Basketball_court_half_court.svg.png'); background-size: cover; background-position: center;">
                    <img src="${ex.drawing}" style="width:100%; display:block;" alt="Esquema táctico">
                </div>`;
            } else if (ex.image) {
                imgHtml = `<div style="margin-bottom:10px; border-radius:8px; overflow:hidden; height:150px;">
                    <img src="${ex.image}" style="width:100%; height:100%; object-fit:cover;" alt="Imagen ejercicio">
                </div>`;
            }

            card.innerHTML = `
                ${imgHtml}
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h3>${ex.title}</h3>
                    <button class="btn-delete-ex" data-id="${ex.id}" style="background:none; border:none; color:var(--text-muted); cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="tags">
                    ${agesHtml}
                    ${typesHtml}
                </div>
                <p>${ex.description}</p>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                    <i class="fa-regular fa-clock"></i> ${ex.duration} min
                </div>
            `;

            card.querySelector('.btn-delete-ex').addEventListener('click', async (e) => {
                if (confirm('¿Seguro que quieres borrar este ejercicio?')) {
                    await deleteDoc(doc(db, "trainer_exercises", ex.id));
                }
            });

            exercisesListEl.appendChild(card);
        });
    };

    // --- Trainings Logic ---

    btnCreateTraining.addEventListener('click', () => {
        STATE.pickerContext = 'create'; // Set context
        formTraining.reset();
        STATE.tempTrainingExercises = [];
        renderSelectedExercises();
        openModal(modalTraining);
    });

    btnOpenPicker.addEventListener('click', () => {
        // Context is already set to 'create' if coming from Create Modal
        // But let's ensure
        STATE.pickerContext = 'create';
        renderPickerList();
        openModal(modalPicker);
    });

    // EDIT: Add exercise button in Detail
    if (btnDetailAddExercise) {
        btnDetailAddExercise.addEventListener('click', () => {
            STATE.pickerContext = 'edit';
            renderPickerList();
            openModal(modalPicker);
        });
    }

    const renderPickerList = () => {
        pickerListEl.innerHTML = '';
        STATE.exercises.forEach(ex => {
            const item = document.createElement('div');
            item.className = 'picker-item';
            item.innerHTML = `
                <div>
                    <h4>${ex.title}</h4>
                    <span style="font-size:0.8rem; color:#888;">${ex.types ? ex.types.join(', ') : ''}</span>
                </div>
                <button type="button" class="btn-primary" style="padding: 4px 10px; font-size: 0.8rem;">
                    <i class="fa-solid fa-plus"></i>
                </button>
            `;
            item.querySelector('button').addEventListener('click', () => {
                handlePickerSelection(ex);
                closeModal(modalPicker);
            });
            pickerListEl.appendChild(item);
        });
    };

    const handlePickerSelection = async (ex) => {
        if (STATE.pickerContext === 'create') {
            STATE.tempTrainingExercises.push(ex);
            renderSelectedExercises();
        } else if (STATE.pickerContext === 'edit') {
            // Add to current training and save
            if (!STATE.currentTrainingId) return;
            const training = STATE.trainings.find(t => t.id === STATE.currentTrainingId);
            if (!training) return;

            const newExObj = {
                id: ex.id,
                title: ex.title,
                duration: ex.duration,
                type: ex.types ? ex.types[0] : ''
            };

            const updatedExercises = [...(training.exercises || []), newExObj];

            // Optimistic update
            training.exercises = updatedExercises;
            renderTrainingDetail(training);

            try {
                await updateDoc(doc(db, "trainer_trainings", training.id), {
                    exercises: updatedExercises
                });
            } catch (e) {
                console.error("Error adding exercise to training:", e);
                alert("Error al añadir ejercicio.");
            }
        }
    };

    const renderSelectedExercises = () => {
        selectedExercisesListEl.innerHTML = '';
        if (STATE.tempTrainingExercises.length === 0) {
            selectedExercisesListEl.innerHTML = '<p class="empty-state">No hay ejercicios añadidos aún.</p>';
            return;
        }

        STATE.tempTrainingExercises.forEach((ex, index) => {
            const item = document.createElement('div');
            item.className = 'selected-exercise-item';
            item.innerHTML = `
                <span>${index + 1}. ${ex.title} (${ex.duration}m)</span>
                <button type="button" class="remove-ex-btn">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            item.querySelector('.remove-ex-btn').addEventListener('click', () => {
                STATE.tempTrainingExercises.splice(index, 1);
                renderSelectedExercises();
            });
            selectedExercisesListEl.appendChild(item);
        });
    };

    formTraining.addEventListener('submit', async (e) => {
        e.preventDefault();
        const exercisesToSave = STATE.tempTrainingExercises.map(ex => ({
            id: ex.id,
            title: ex.title,
            duration: ex.duration,
            type: ex.types ? ex.types[0] : ''
        }));

        const newTraining = {
            date: document.getElementById('tr-date').value,
            time: document.getElementById('tr-time').value,
            duration: document.getElementById('tr-duration').value,
            notes: document.getElementById('tr-notes').value,
            exercises: exercisesToSave,
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(trainingsCol, newTraining);
            closeModal(modalTraining);
        } catch (e) {
            console.error("Error creating training: ", e);
            alert("Error al crear el entrenamiento.");
        }
    });

    const renderTrainings = () => {
        trainingsListEl.innerHTML = '';
        if (STATE.trainings.length === 0) {
            trainingsListEl.innerHTML = '<p style="color: grey; text-align: center;">Cargando o sin entrenamientos...</p>';
            return;
        }

        STATE.trainings.forEach(tr => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.cursor = 'pointer';

            const exCount = tr.exercises ? tr.exercises.length : 0;
            const exList = tr.exercises ? tr.exercises.slice(0, 3).map(e => e.title).join(', ') + (exCount > 3 ? '...' : '') : 'Sin ejercicios';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <h3><i class="fa-regular fa-calendar"></i> ${tr.date}</h3>
                    <span><i class="fa-regular fa-clock"></i> ${tr.time}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 1rem;">
                    <p><strong>Duración:</strong> ${tr.duration} min</p>
                    <button class="btn-delete-tr" data-id="${tr.id}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; z-index:10;"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div style="background: #252525; padding: 10px; border-radius: 8px; margin-top: 10px;">
                    <small style="color: var(--primary-color);">Ejercicios (${exCount})</small>
                    <p style="margin: 5px 0 0 0; font-size: 0.9rem;">${exList}</p>
                </div>
            `;

            card.querySelector('.btn-delete-tr').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('¿Borrar entrenamiento?')) {
                    await deleteDoc(doc(db, "trainer_trainings", tr.id));
                    if (STATE.currentTrainingId === tr.id) navigateTo('trainings');
                }
            });

            card.addEventListener('click', () => {
                openTrainingDetail(tr);
            });

            trainingsListEl.appendChild(card);
        });
    };

    // --- Detail View Logic (Trainings) ---

    const openTrainingDetail = (training) => {
        STATE.currentTrainingId = training.id;
        renderTrainingDetail(training);
        navigateTo('training-detail');
    };

    const renderTrainingDetail = (training) => {
        document.getElementById('detail-date').textContent = training.date;
        document.getElementById('detail-time').textContent = training.time;
        document.getElementById('detail-duration').textContent = training.duration + ' min';
        document.getElementById('detail-notes').textContent = training.notes || 'Sin observaciones';

        detailTimelineEl.innerHTML = '';
        if (!training.exercises || training.exercises.length === 0) {
            detailTimelineEl.innerHTML = '<p style="text-align:center; color:grey;">Sin ejercicios</p>';
            return;
        }

        let currentTime = new Date(`2000-01-01T${training.time}:00`);

        training.exercises.forEach((ex, index) => {
            const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Image handling for timeline
            let imgSrc = '';
            if (ex.drawings && ex.drawings.length > 0) imgSrc = ex.drawings[0];
            else if (ex.drawing) imgSrc = ex.drawing;
            else if (ex.image) imgSrc = ex.image;

            // Fallback image if none
            if (!imgSrc) {
                imgSrc = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Basketball_court_half_court.svg/800px-Basketball_court_half_court.svg.png';
            }

            const row = document.createElement('div');
            row.className = 'timeline-item';
            row.innerHTML = `
                <div class="time-col">
                    <span class="time-start">${timeString}</span>
                    <span class="time-duration">${ex.duration} min</span>
                </div>
                <div class="img-col">
                    <img src="${imgSrc}" alt="Esquema">
                </div>
                <div class="info-col">
                    <h4>${ex.title}</h4>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                         <span class="tag primary" style="width:fit-content; font-size:0.75rem;">${ex.type || 'Ejercicio'}</span>
                    </div>
                </div>
                <div class="actions-col">
                    <button class="btn-move btn-up" ${index === 0 ? 'disabled' : ''} title="Subir">
                        <i class="fa-solid fa-chevron-up"></i>
                    </button>
                    <button class="btn-move btn-down" ${index === training.exercises.length - 1 ? 'disabled' : ''} title="Bajar">
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                    <button class="btn-move btn-delete-item" title="Eliminar del entreno" style="color: #ff4444;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;

            row.querySelector('.btn-up').addEventListener('click', () => moveExercise(training, index, -1));
            row.querySelector('.btn-down').addEventListener('click', () => moveExercise(training, index, 1));

            // Delete Listener
            row.querySelector('.btn-delete-item').addEventListener('click', () => removeExerciseFromTraining(training, index));

            detailTimelineEl.appendChild(row);
            currentTime.setMinutes(currentTime.getMinutes() + parseInt(ex.duration || 0));
        });
    };

    const moveExercise = async (training, index, direction) => {
        const exercises = [...training.exercises];
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= exercises.length) return;
        [exercises[index], exercises[newIndex]] = [exercises[newIndex], exercises[index]];
        training.exercises = exercises;
        renderTrainingDetail(training);
        try {
            await updateDoc(doc(db, "trainer_trainings", training.id), {
                exercises: exercises
            });
        } catch (e) {
            console.error("Error updating order:", e);
            alert("Error al guardar el nuevo orden.");
        }
    };

    // Remove Exercise from Detail View
    const removeExerciseFromTraining = async (training, index) => {
        if (!confirm("¿Quitar este ejercicio del entrenamiento?")) return;

        const exercises = [...training.exercises];
        exercises.splice(index, 1);

        training.exercises = exercises;
        renderTrainingDetail(training); // Update UI

        try {
            await updateDoc(doc(db, "trainer_trainings", training.id), {
                exercises: exercises
            });
        } catch (e) {
            console.error("Error removing exercise:", e);
            alert("Error al eliminar ejercicio.");
        }
    };
});
