import re

with open(r'c:\Users\jorgi\Documents\ANTIGRAVITY\basketball-manager\index.html', 'r', encoding='utf-8') as f:
    content = f.read()
    
# Find the exact malformed string
target = """                {/* Loading Overlay */}
                {(importing || syncing) && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-[80vw] mx-auto text-center border border-slate-100">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-100 border-b-emerald-500 mb-4"></div>
                            <p className="text-slate-800 font-bold text-lg">Conectando con FBCV...</p>
                            <p className="text-slate-500 text-sm mt-1 font-medium">Esto puede tardar unos segundos</p>
                        </div>
                    </div>
                )}
            </div>
        );
    };"""

target2 = """                {/* Loading Overlay */ }
            {
                (importing || syncing) && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-[80vw] mx-auto text-center border border-slate-100">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-100 border-b-emerald-500 mb-4"></div>
                            <p className="text-slate-800 font-bold text-lg">Conectando con FBCV...</p>
                            <p className="text-slate-500 text-sm mt-1 font-medium">Esto puede tardar unos segundos</p>
                        </div>
                    </div>
                )
            }
            </div >
        );
    };"""

target3 = """                {/* Loading Overlay */}
                {(importing || syncing) && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-[80vw] mx-auto text-center border border-slate-100">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-100 border-b-emerald-500 mb-4"></div>
                            <p className="text-slate-800 font-bold text-lg">Conectando con FBCV...</p>
                            <p className="text-slate-500 text-sm mt-1 font-medium">Esto puede tardar unos segundos</p>
                        </div>
                    </div>
                )}
            </div >
        );
    };"""

replacement = """                {/* Loading Overlay */}
                {(importing || syncing) && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-200">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-[80vw] mx-auto text-center border border-slate-100">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-100 border-b-emerald-500 mb-4"></div>
                            <p className="text-slate-800 font-bold text-lg">Conectando con FBCV...</p>
                            <p className="text-slate-500 text-sm mt-1 font-medium">Esto puede tardar unos segundos</p>
                        </div>
                    </div>
                )}
            </div>
        );
    };"""

content = content.replace(target, replacement).replace(target2, replacement).replace(target3, replacement)

with open(r'c:\Users\jorgi\Documents\ANTIGRAVITY\basketball-manager\index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("File updated")
