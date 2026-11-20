import { useState, type FormEvent } from 'react';
import { useCreateItem, useItems } from './hooks/useItems';

export function App() {
  const { data: items, isLoading, isError, error } = useItems();
  const createItemMutation = useCreateItem();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim() || !name.trim()) return;

    createItemMutation.mutate(
      { code: code.trim(), name: name.trim() },
      {
        onSuccess: () => {
          setCode('');
          setName('');
        },
      },
    );
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          React + GAS Starter Template
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          TanStack Query + Google Apps Script Web App API + Google Sheets
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Add Item</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code (e.g. 00123)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={createItemMutation.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {createItemMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </form>
        {createItemMutation.isError && (
          <p className="mt-2 text-sm text-red-600">{createItemMutation.error.message}</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Items</h2>

        {isLoading && <p className="text-sm text-slate-500">Loading items...</p>}

        {isError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to load items: {error.message}
          </div>
        )}

        {!isLoading && !isError && (!items || items.length === 0) && (
          <p className="text-sm text-slate-500">No items found.</p>
        )}

        {!isLoading && !isError && items && items.length > 0 && (
          <ul className="divide-y divide-slate-200">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="font-mono text-xs text-slate-500">{item.code}</span>
                  <span className="ml-3 font-medium text-slate-800">{item.name}</span>
                </div>
                <span className="text-xs text-slate-400">{item.createdAt}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default App;
