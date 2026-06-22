import React from 'react';

export function FilterBar() {
  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
      <button className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-full whitespace-nowrap">
        All Matches
      </button>
      <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-full hover:bg-slate-50 whitespace-nowrap">
        High Confidence (🟢)
      </button>
      <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-full hover:bg-slate-50 whitespace-nowrap">
        Premier League
      </button>
      <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-full hover:bg-slate-50 whitespace-nowrap">
        La Liga
      </button>
    </div>
  );
}
