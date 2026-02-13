
// Sub-component to handle substitution logic and state
const SubstitutionView = ({ players, currentP, localHistory, onCancel, onConfirm }) => {
    const currentPeriodData = localHistory[currentP] || {};
    const currentIds = Object.keys(currentPeriodData);
    // Players on court
    const candidatesOut = players.filter(p => currentIds.includes(p.id));
    // Players on bench (part of match squad but not on court) - Ensure we filter out disabled players correctly if needed
    const candidatesIn = players.filter(p => !currentIds.includes(p.id) && !p.disabled);

    const [selectedOut, setSelectedOut] = useState(null);
    const [selectedIn, setSelectedIn] = useState(null);

    // Ensure icons load when this component mounts
    useEffect(() => {
        lucide.createIcons();
    }, []);

    return (
        <div className="p-4 max-w-md mx-auto">
            <h2 className="font-bold text-lg mb-4 text-red-600 flex items-center gap-2">
                <i data-lucide="activity" className="w-5 h-5"></i> Sustitución por Lesión (P{currentP})
            </h2>
            <p className="text-sm text-slate-500 mb-4">Selecciona quién sale y quién entra. Este periodo no contará como jugado completo para ninguno de los dos.</p>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Sale (Lesionado)</label>
                    <div className="grid grid-cols-2 gap-2">
                        {candidatesOut.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedOut(p.id)}
                                className={`p-3 border rounded-xl text-left ${selectedOut === p.id ? 'bg-red-50 border-red-500 ring-1 ring-red-500' : 'bg-white border-slate-200'}`}
                            >
                                <span className="font-bold text-slate-700">#{p.number}</span> <span className="text-sm">{p.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-center text-slate-300">
                    <i data-lucide="arrow-down" className="w-6 h-6"></i>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Entra (Sustituto)</label>
                    <div className="grid grid-cols-2 gap-2">
                        {candidatesIn.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedIn(p.id)}
                                className={`p-3 border rounded-xl text-left ${selectedIn === p.id ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'bg-white border-slate-200'}`}
                            >
                                <span className="font-bold text-slate-700">#{p.number}</span> <span className="text-sm">{p.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-8">
                <button onClick={onCancel} className="p-3 border rounded-xl font-bold text-slate-500">Cancelar</button>
                <button
                    onClick={() => onConfirm(selectedOut, selectedIn)}
                    disabled={!selectedOut || !selectedIn}
                    className="p-3 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50"
                >
                    Confirmar Cambio
                </button>
            </div>
        </div>
    );
};
