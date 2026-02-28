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

    const getCanvasPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        // Scale coordinates to match CSS vs internal resolution
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        isDrawing = true;
        const pos = getCanvasPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        draw(e);
    };

    const stopDrawing = () => {
        isDrawing = false;
        ctx.beginPath();
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const pos = getCanvasPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
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
            thumb.style.position = 'relative'; // Ensure positioning context

            // Add light background to thumbnails so strokes are visible
            thumb.innerHTML = `
                <img src="${imgSrc}" style="background-color: #e0e0e0; border-radius: 4px; display: block; width: 100%; height: 100%;">
                <button type="button" class="btn-delete-frame" title="Eliminar paso" style="position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border-radius: 50%; background: rgba(255, 68, 68, 0.9); border: none; color: white; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: pointer;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;

            // Delete action
            thumb.querySelector('.btn-delete-frame').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent trigger if we add click-to-load later
                if (confirm("¿Eliminar este paso del ejercicio?")) {
                    STATE.currentDrawings.splice(index, 1);
                    renderDrawingFrames(); // Re-render the list
                }
            });

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
            // If drawing exists, append it. 
            // NOTE: In edit mode, if we just opened and didn't draw, we might not want to duplicates.
            // But current logic is simple: whatever is on canvas gets saved.
            // A better approach for edit: check if it changed. 
            // For now, we only push if it's NOT blank. 
            STATE.currentDrawings.push(canvas.toDataURL());
        }

        const exerciseData = {
            title: document.getElementById('ex-title').value,
            description: document.getElementById('ex-description').value,
            image: document.getElementById('ex-image').value,
            drawings: STATE.currentDrawings,
            drawing: STATE.currentDrawings.length > 0 ? STATE.currentDrawings[0] : null,
            ages: selectedAges,
            types: selectedTypes,
            duration: document.getElementById('ex-duration').value,
            variants: document.getElementById('ex-variants').value,
            updatedAt: new Date().toISOString()
        };

        if (!STATE.editingExerciseId) {
            exerciseData.createdAt = new Date().toISOString();
        }

        try {
            if (STATE.editingExerciseId) {
                await updateDoc(doc(db, "trainer_exercises", STATE.editingExerciseId), exerciseData);
            } else {
                await addDoc(exercisesCol, exerciseData);
            }
            closeModal(modalExercise);
            STATE.editingExerciseId = null; // Reset
        } catch (e) {
            console.error("Error saving exercise: ", e);
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
            // Always ensure image container exists
            let imgSrc = '';
            let extraHtml = '';

            const isValidImg = (src) => src && typeof src === 'string' && src !== 'undefined' && src !== 'null' && src.trim() !== '';

            if (ex.drawings && Array.isArray(ex.drawings) && ex.drawings.length > 0 && isValidImg(ex.drawings[0])) {
                imgSrc = ex.drawings[0];
                if (ex.drawings.length > 1) {
                    extraHtml = `<span style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.7); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem;">+${ex.drawings.length - 1} pasos</span>`;
                }
            } else if (isValidImg(ex.drawing)) {
                imgSrc = ex.drawing;
            } else if (isValidImg(ex.image)) {
                imgSrc = ex.image;
            }

            if (!imgSrc) {
                imgSrc = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Basketball_court_half_court.svg/800px-Basketball_court_half_court.svg.png';
            }

            imgHtml = `<div style="position:relative; margin-bottom:10px; border:1px solid #333; border-radius:8px; overflow:hidden; height:180px; background-color:#e0e0e0;">
                <img src="${imgSrc}" style="width:100%; height:100%; object-fit:cover;" alt="Esquema táctico">
                ${extraHtml}
            </div>`;

            card.innerHTML = `
                ${imgHtml}
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h3>${ex.title}</h3>
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

            card.style.cursor = 'pointer';
            card.addEventListener('click', () => openEditExerciseModal(ex));

            exercisesListEl.appendChild(card);
        });
    };

    // --- Edit Exercise Logic ---
    const openEditExerciseModal = (ex) => {
        STATE.editingExerciseId = ex.id; // Track ID
        document.getElementById('ex-title').value = ex.title;
        document.getElementById('ex-description').value = ex.description;
        document.getElementById('ex-image').value = ex.image || '';
        document.getElementById('ex-duration').value = ex.duration;
        document.getElementById('ex-variants').value = ex.variants || '';

        // Types
        const typeSelect = document.getElementById('ex-type');
        Array.from(typeSelect.options).forEach(opt => {
            opt.selected = ex.types && ex.types.includes(opt.value);
        });

        // Ages
        document.querySelectorAll('input[name="ex-age"]').forEach(cb => {
            cb.checked = ex.ages && ex.ages.includes(cb.value);
        });

        // Drawings
        STATE.currentDrawings = ex.drawings || (ex.drawing ? [ex.drawing] : []);
        renderDrawingFrames();
        clearCanvas(); // Start with blank canvas or load first frame? 
        // Loading first frame to canvas might be complex due to 'load' event, 
        // for now just showing thumbnails is safer.
        setTimeout(setupCanvas, 100);


        const btnDelete = document.getElementById('btn-delete-exercise-modal');
        if (btnDelete) {
            btnDelete.style.display = 'block';
            btnDelete.onclick = async () => {
                if (confirm('¿Seguro que quieres borrar este ejercicio?')) {
                    await deleteDoc(doc(db, "trainer_exercises", ex.id));
                    closeModal(modalExercise);
                }
            };
        }




        openModal(modalExercise);
    };

    // Update Add Button to reset state
    btnAddExercise.addEventListener('click', () => {
        STATE.editingExerciseId = null;
        const btnDelete = document.getElementById('btn-delete-exercise-modal');
        if (btnDelete) btnDelete.style.display = 'none';
    });

    // Update Add Button to reset state
    btnAddExercise.addEventListener('click', () => {
        STATE.editingExerciseId = null;
        const btnDelete = document.getElementById('btn-delete-exercise-modal');
        if (btnDelete) btnDelete.style.display = 'none';
        // Note: we rely on the other listener to open modal and reset form
    });

    // Update Add Button to reset state
    const originalAddBtnHandler = btnAddExercise.onclick; // Save if needed, but better to replace or extend
    // Re-bind click
    btnAddExercise.onclick = null; // Clear old if any inline, but we used addEventListener
    // Note: Since we used addEventListener ('click', ...), we can't easily remove anonymous function.
    // Instead, let's just modify the existing listener or handling logic.
    // Actually, let's just make sure we reset editingId in the existing listener.
    // Easier approach: Just add a new listener that runs FIRST if possible, or modify the boolean.
    // We'll replace the listener logic by re-writing it below if we could. 
    // BUT we can't overwrite anonymous listeners. 
    // New Strategy: We'll modify the STATE.editingExerciseId inside the `btnAddExercise` listener we already defined?
    // No, we defined it in the block above (line 118). 
    // Let's attach a NEW listener that resets it, assuming it runs.

    btnAddExercise.addEventListener('click', () => {
        STATE.editingExerciseId = null; // Reset to create mode
        // The other listener (line 118) handles form reset.
    });


    // Override Submit Handler logic
    // We need to modify the submit handler at line 230 to check for STATE.editingExerciseId
    // Since we are REPLACING code, we will rewrite the submit handler here in this tool call context 
    // but the previous replace_file_content targeted renderExercises. 
    // Wait, I can't rewrite line 230 from here effectively without a huge block.
    // I will replace line 230 in a separate call or encompass it here if I scroll up.
    // This replace block ends at 320. 

    // Let's stick to adding the button and helper here. I will do the submit handler update in next step.


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
        const newExObj = {
            id: ex.id,
            title: ex.title,
            duration: ex.duration,
            type: ex.types ? ex.types[0] : '',
            // Ensure all image properties are carried over correctly
            image: ex.image || null,
            drawing: ex.drawing || null,
            drawings: ex.drawings || []
        };

        if (STATE.pickerContext === 'create') {
            STATE.tempTrainingExercises.push(newExObj);
            renderSelectedExercises();
        } else if (STATE.pickerContext === 'edit') {
            // Add to current training and save
            if (!STATE.currentTrainingId) return;
            const training = STATE.trainings.find(t => t.id === STATE.currentTrainingId);
            if (!training) return;

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
            type: ex.types ? ex.types[0] : '',
            // Fix: Include image data so it persists
            image: ex.image || null,
            drawing: ex.drawing || null,
            drawings: ex.drawings || []
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

        let firstIncompleteFound = false;

        training.exercises.forEach((ex, index) => {
            const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Lookup canonical exercise from library to get the latest image data
            const canonEx = STATE.exercises.find(e => e.id === ex.id) || ex;

            // Image handling for timeline
            let imgSrc = '';

            const isValidImg = (src) => {
                if (!src || typeof src !== 'string') return false;
                const lowerSrc = src.toLowerCase();
                if (lowerSrc === 'undefined' || lowerSrc === 'null' || lowerSrc.includes('base64,undefined') || lowerSrc.includes('base64,null')) return false;
                return src.trim() !== '';
            };

            // Prefer canonEx images, fallback to ex images
            if (canonEx.drawings && Array.isArray(canonEx.drawings) && canonEx.drawings.length > 0 && isValidImg(canonEx.drawings[0])) {
                imgSrc = canonEx.drawings[0];
            } else if (isValidImg(canonEx.drawing)) {
                imgSrc = canonEx.drawing;
            } else if (isValidImg(canonEx.image)) {
                imgSrc = canonEx.image;
            } else if (ex.drawings && Array.isArray(ex.drawings) && ex.drawings.length > 0 && isValidImg(ex.drawings[0])) {
                imgSrc = ex.drawings[0];
            } else if (isValidImg(ex.drawing)) {
                imgSrc = ex.drawing;
            } else if (isValidImg(ex.image)) {
                imgSrc = ex.image;
            }

            // Fallback image if none or invalid
            if (!imgSrc) {
                imgSrc = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Basketball_court_half_court.svg/800px-Basketball_court_half_court.svg.png';
            }

            const row = document.createElement('div');
            row.className = 'timeline-item';

            // Determine status
            const isCompleted = ex.completed === true;
            if (isCompleted) {
                row.classList.add('completed');
            } else if (!firstIncompleteFound) {
                row.classList.add('current');
                row.id = 'current-exercise'; // ID for scrolling
                firstIncompleteFound = true;
            }

            row.innerHTML = `
                <div class="time-col">
                    <span class="time-start">${timeString}</span>
                    <span class="time-duration">${ex.duration} min</span>
                </div>
                <div class="img-col">
                    <img src="${imgSrc}" alt="Esquema" style="background-color: #e0e0e0; border-radius: 4px;">
                </div>
                <div class="info-col">
                    <div style="margin-bottom: 4px;">
                        <button class="btn-view-link" style="background:none; border:none; color:var(--primary-color); cursor:pointer; font-size:0.85rem; padding:0; display:flex; align-items:center; gap:4px;">
                            <i class="fa-regular fa-eye"></i> Ver detalle
                        </button>
                    </div>
                    <h4>${ex.title}</h4>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                         <span class="tag primary" style="width:fit-content; font-size:0.75rem;">${ex.type || 'Ejercicio'}</span>
                    </div>
                </div>
                <div class="actions-col">
                    <button class="btn-check" title="${isCompleted ? 'Marcar como pendiente' : 'Marcar como completado'}">
                        <i class="fa-solid fa-check"></i>
                    </button>
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

            row.querySelector('.btn-check').addEventListener('click', () => toggleExerciseCompletion(training, index));
            row.querySelector('.btn-view-link').addEventListener('click', (e) => {
                e.stopPropagation();
                openViewExerciseModal(ex);
            });
            row.querySelector('.btn-up').addEventListener('click', () => moveExercise(training, index, -1));
            row.querySelector('.btn-down').addEventListener('click', () => moveExercise(training, index, 1));
            row.querySelector('.btn-delete-item').addEventListener('click', () => removeExerciseFromTraining(training, index));

            detailTimelineEl.appendChild(row);
            currentTime.setMinutes(currentTime.getMinutes() + parseInt(ex.duration || 0));
        });

        // Auto-scroll to current exercise
        setTimeout(() => {
            const currentEx = document.getElementById('current-exercise');
            if (currentEx) {
                currentEx.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    };

    // --- View Detail Logic ---
    const modalView = document.getElementById('modal-view-exercise');
    const closeViewBtn = document.querySelector('.close-view-modal');

    if (closeViewBtn) {
        closeViewBtn.addEventListener('click', () => closeModal(modalView));
    }

    const openViewExerciseModal = (ex) => {
        document.getElementById('view-ex-title').textContent = ex.title;
        document.getElementById('view-ex-desc').textContent = ex.description || 'Sin descripción';
        document.getElementById('view-ex-variants').textContent = ex.variants || 'Sin variantes';
        document.getElementById('view-ex-duration').textContent = (ex.duration || 0) + ' min';

        const tagsContainer = document.getElementById('view-ex-tags');
        tagsContainer.innerHTML = '';
        if (ex.types && Array.isArray(ex.types)) {
            ex.types.forEach(t => {
                tagsContainer.innerHTML += `<span class="tag primary">${t}</span>`;
            });
        }

        // Image Handling
        const mainImgContainer = document.getElementById('view-main-image');
        mainImgContainer.style.backgroundColor = '#e0e0e0'; // Apply bright background
        const mainImg = mainImgContainer.querySelector('img');
        const framesList = document.getElementById('view-frames-list');
        framesList.innerHTML = '';

        // Lookup canonical exercise from library to get the latest image data
        const canonEx = STATE.exercises.find(e => e.id === ex.id) || ex;

        const isValidImg = (src) => {
            if (!src || typeof src !== 'string') return false;
            const lowerSrc = src.toLowerCase();
            if (lowerSrc === 'undefined' || lowerSrc === 'null' || lowerSrc.includes('base64,undefined') || lowerSrc.includes('base64,null')) return false;
            return src.trim() !== '';
        };

        let frames = [];
        if (canonEx.drawings && Array.isArray(canonEx.drawings) && canonEx.drawings.length > 0 && isValidImg(canonEx.drawings[0])) {
            frames = canonEx.drawings;
        } else if (isValidImg(canonEx.drawing)) {
            frames = [canonEx.drawing];
        } else if (isValidImg(canonEx.image)) {
            frames = [canonEx.image];
        } else if (ex.drawings && Array.isArray(ex.drawings) && ex.drawings.length > 0 && isValidImg(ex.drawings[0])) {
            frames = ex.drawings;
        } else if (isValidImg(ex.drawing)) {
            frames = [ex.drawing];
        } else if (isValidImg(ex.image)) {
            frames = [ex.image];
        }

        const btnPrev = document.getElementById('view-prev-img-btn');
        const btnNext = document.getElementById('view-next-img-btn');

        if (frames.length > 0) {
            let currentFrameIndex = 0;

            const updateSlider = () => {
                mainImg.src = frames[currentFrameIndex];
                if (frames.length > 1) {
                    btnPrev.style.display = currentFrameIndex > 0 ? 'flex' : 'none';
                    btnNext.style.display = currentFrameIndex < frames.length - 1 ? 'flex' : 'none';

                    Array.from(framesList.children).forEach((thumb, idx) => {
                        thumb.style.outline = idx === currentFrameIndex ? '2px solid var(--primary-color)' : 'none';
                    });
                } else {
                    btnPrev.style.display = 'none';
                    btnNext.style.display = 'none';
                }
            };

            btnPrev.onclick = () => {
                if (currentFrameIndex > 0) {
                    currentFrameIndex--;
                    updateSlider();
                }
            };

            btnNext.onclick = () => {
                if (currentFrameIndex < frames.length - 1) {
                    currentFrameIndex++;
                    updateSlider();
                }
            };

            // Thumbnails
            if (frames.length > 1) {
                frames.forEach((src, idx) => {
                    if (!isValidImg(src)) return;
                    const thumb = document.createElement('div');
                    thumb.className = 'frame-thumb';
                    thumb.setAttribute('style', 'cursor:pointer; outline-offset:-2px;');
                    thumb.innerHTML = `<img src="${src}" style="background-color: #e0e0e0; border-radius: 4px;">`;
                    thumb.addEventListener('click', () => {
                        currentFrameIndex = idx;
                        updateSlider();
                    });
                    framesList.appendChild(thumb);
                });
            }

            updateSlider(); // Initialize

        } else {
            mainImg.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Basketball_court_half_court.svg/800px-Basketball_court_half_court.svg.png';
            mainImgContainer.style.backgroundColor = 'transparent'; // Remove bg for placeholder
            btnPrev.style.display = 'none';
            btnNext.style.display = 'none';
        }

        openModal(modalView);
    };

    const toggleExerciseCompletion = async (training, index) => {
        const exercises = [...training.exercises];
        const exercise = exercises[index];

        // Toggle status
        exercise.completed = !exercise.completed;

        // Update local state and re-render immediately for responsiveness
        training.exercises = exercises;
        renderTrainingDetail(training);

        try {
            await updateDoc(doc(db, "trainer_trainings", training.id), {
                exercises: exercises
            });
        } catch (e) {
            console.error("Error updating completion status:", e);
            // Revert on error (optional, but good practice)
            exercise.completed = !exercise.completed;
            renderTrainingDetail(training);
            alert("Error al actualizar estado.");
        }
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
