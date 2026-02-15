        const AllMatchesCalendarView = ({ teams, matches, navigate }) => {
            const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'
            const [currentDate, setCurrentDate] = useState(new Date());

            useEffect(() => {
                lucide.createIcons();
            }, [viewMode, currentDate]);

            // Helper functions for date manipulation (Reused logic)
            const getMonthDays = (date) => {
                const year = date.getFullYear();
                const month = date.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const daysInMonth = lastDay.getDate();
                const dayOfWeek = firstDay.getDay();
                const startingDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const days = [];
                for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
                for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day));
                return days;
            };

            const getWeekDays = (date) => {
                const dayOfWeek = date.getDay();
                const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                const monday = new Date(date.setDate(diff));
                const days = [];
                for (let i = 0; i < 7; i++) {
                    const day = new Date(monday);
                    day.setDate(monday.getDate() + i);
                    days.push(day);
                }
                return days;
            };

            const getMatchesForDate = (date) => {
                if (!date) return [];
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                return matches.filter(m => m.date === dateStr);
            };

            const formatMonthYear = (date) => {
                const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                return `${months[date.getMonth()]} ${date.getFullYear()} `;
            };

            const formatWeekRange = (days) => {
                const first = days[0];
                const last = days[6];
                return `${first.getDate()} - ${last.getDate()} ${formatMonthYear(first)} `;
            };

            const formatDayDate = (date) => {
                const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                return `${days[date.getDay()]}, ${date.getDate()} de ${formatMonthYear(date)} `;
            };

            const goToToday = () => setCurrentDate(new Date());
            const goToPrevious = () => {
                const newDate = new Date(currentDate);
                if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
                else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
                else newDate.setDate(newDate.getDate() - 1);
                setCurrentDate(newDate);
            };
            const goToNext = () => {
                const newDate = new Date(currentDate);
                if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
                else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
                else newDate.setDate(newDate.getDate() + 1);
                setCurrentDate(newDate);
            };

            const MatchCard = ({ match, compact = false }) => {
                const team = teams.find(t => t.id === match.teamId);
                const teamName = team ? team.name : 'Equipo Desconocido';
                
                return (
                    <div
                        onClick={() => navigate('active-match', match.teamId, match.id)}
                        className={`${compact ? 'p-1.5' : 'p-2'} bg-white border-l-4 ${match.isHome ? 'border-blue-500' : 'border-orange-500'} rounded shadow-sm hover:shadow-md transition-all cursor-pointer group`}
                        title={teamName}
                    >
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate mb-0.5">{teamName}</p>
                        <p className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold text-slate-800 truncate group-hover:text-blue-600`}>
                            {compact ? match.opponent : `vs ${match.opponent}`}
                        </p>
                        {!compact && (
                            <p className="text-[9px] text-slate-500 mt-0.5">
                                {match.time}h {match.isHome ? '🏠' : '✈️'}
                            </p>
                        )}
                    </div>
                );
            };

            return (
                <div className="p-4 max-w-4xl mx-auto pb-24">
                    <header className="flex items-center gap-2 mb-6">
                        <button onClick={() => navigate('teams-list')} className="p-2 -ml-2 text-slate-400 hover:text-slate-800 transition-colors">
                            <span dangerouslySetInnerHTML={{ __html: '<i data-lucide="chevron-left"></i>' }}></span>
                        </button>
                        <h1 className="text-2xl font-bold text-slate-800">Calendario Global</h1>
                    </header>

                    <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                        <button onClick={() => setViewMode('month')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>MES</button>
                        <button onClick={() => setViewMode('week')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>SEMANA</button>
                        <button onClick={() => setViewMode('day')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>DÍA</button>
                    </div>

                    <div className="flex items-center justify-between mb-6 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <button onClick={goToPrevious} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <span dangerouslySetInnerHTML={{ __html: '<i data-lucide="chevron-left" class="w-5 h-5"></i>' }}></span>
                        </button>
                        <div className="text-center">
                            <p className="font-bold text-slate-800">
                                {viewMode === 'month' && formatMonthYear(currentDate)}
                                {viewMode === 'week' && formatWeekRange(getWeekDays(currentDate))}
                                {viewMode === 'day' && formatDayDate(currentDate)}
                            </p>
                            <button onClick={goToToday} className="text-[10px] text-blue-600 font-bold hover:underline mt-0.5">Hoy</button>
                        </div>
                        <button onClick={goToNext} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <span dangerouslySetInnerHTML={{ __html: '<i data-lucide="chevron-right" class="w-5 h-5"></i>' }}></span>
                        </button>
                    </div>

                    {viewMode === 'month' && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, i) => (
                                    <div key={i} className="p-2 text-center text-[10px] font-bold text-slate-600">{day}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7">
                                {getMonthDays(currentDate).map((day, i) => {
                                    const dayMatches = day ? getMatchesForDate(day) : [];
                                    const isToday = day && day.toDateString() === new Date().toDateString();
                                    return (
                                        <div key={i} className={`min-h-[80px] p-1.5 border-b border-r border-slate-100 ${!day ? 'bg-slate-50' : ''} ${isToday ? 'bg-blue-50' : ''}`}>
                                            {day && (
                                                <>
                                                    <p className={`text-xs font-bold mb-1 ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>{day.getDate()}</p>
                                                    <div className="space-y-1">
                                                        {dayMatches.map(m => <MatchCard key={m.id} match={m} compact={true} />)}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {viewMode === 'week' && (
                        <div className="space-y-2">
                            {getWeekDays(currentDate).map((day, i) => {
                                const dayMatches = getMatchesForDate(day);
                                const isToday = day.toDateString() === new Date().toDateString();
                                const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                                return (
                                    <div key={i} className={`bg-white p-3 rounded-xl border border-slate-200 shadow-sm ${isToday ? 'ring-2 ring-blue-500' : ''}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <p className={`font-bold ${isToday ? 'text-blue-600' : 'text-slate-800'}`}>{dayNames[day.getDay()]}</p>
                                                <p className="text-xs text-slate-500">{day.getDate()} {formatMonthYear(day).split(' ')[0]}</p>
                                            </div>
                                            {isToday && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">HOY</span>}
                                        </div>
                                        {dayMatches.length > 0 ? (
                                            <div className="space-y-2">
                                                {dayMatches.map(m => <MatchCard key={m.id} match={m} />)}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">Sin partidos</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {viewMode === 'day' && (
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            {(() => {
                                const dayMatches = getMatchesForDate(currentDate);
                                return dayMatches.length > 0 ? (
                                    <div className="space-y-3">
                                        {dayMatches.map(m => {
                                            const team = teams.find(t => t.id === m.teamId);
                                            return (
                                            <div key={m.id} onClick={() => navigate('active-match', m.teamId, m.id)} className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
                                                <div className="mb-2">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white border border-slate-200 px-2 py-1 rounded-md">{team ? team.name : 'Equipo Desconocido'}</span>
                                                </div>
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <p className="font-bold text-lg text-slate-800 group-hover:text-blue-600">vs {m.opponent}</p>
                                                        <p className="text-xs text-slate-500 mt-1">{m.matchDay || 'Sin jornada'}</p>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${m.isHome ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                                        {m.isHome ? '🏠 Local' : '✈️ Visitante'}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                                                    <div className="flex items-center gap-1">
                                                        <span dangerouslySetInnerHTML={{ __html: '<i data-lucide="clock" class="w-3.5 h-3.5"></i>' }}></span>
                                                        <span>{m.time}h</span>
                                                    </div>
                                                    {m.location && (
                                                        <div className="flex items-center gap-1">
                                                            <span dangerouslySetInnerHTML={{ __html: '<i data-lucide="map-pin" class="w-3.5 h-3.5"></i>' }}></span>
                                                            <span>{m.location}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {m.state === 'finished' && m.score && (
                                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                                        <p className="text-sm font-bold text-slate-700">
                                                            Resultado: <span className={m.result === 'won' ? 'text-green-600' : 'text-red-500'}>{m.score.local} - {m.score.visitor}</span>
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <span dangerouslySetInnerHTML={{ __html: '<i data-lucide="calendar-x" class="w-12 h-12 text-slate-200 mx-auto mb-3"></i>' }}></span>
                                        <p className="text-slate-400 font-medium">No hay partidos programados para este día</p>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            );
        };
