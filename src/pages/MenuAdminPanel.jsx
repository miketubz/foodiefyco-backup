import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import AdminThemeSwitcher from '../components/AdminThemeSwitcher';

export default function MenuAdminPanel() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    category: '',
    image_url: '',
    sort_order: 0,
    is_available: true,
  });

  const fetchMenuItems = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const { data, error } = await supabase
      .from('menu_item')
      .select('id, name, price, category, image_url, is_available, sort_order')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setItems(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const handleChange = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleNewItemChange = (field, value) => {
    setNewItem((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    setError('');
    setMessage('');

    if (!newItem.name.trim()) {
      setError('Name is required.');
      return;
    }

    if (!newItem.price) {
      setError('Price is required.');
      return;
    }

    setCreating(true);

    const { error } = await supabase.from('menu_item').insert([
      {
        name: newItem.name.trim(),
        price: Number(newItem.price),
        category: newItem.category.trim(),
        image_url: newItem.image_url.trim(),
        sort_order: Number(newItem.sort_order) || 0,
        is_available: newItem.is_available,
      },
    ]);

    if (error) {
      setError(error.message);
    } else {
      setMessage('New menu item added.');
      setNewItem({
        name: '',
        price: '',
        category: '',
        image_url: '',
        sort_order: 0,
        is_available: true,
      });
      await fetchMenuItems();
    }

    setCreating(false);
  };

  const handleSave = async (item) => {
    setSavingId(item.id);
    setError('');
    setMessage('');

    const { error } = await supabase
      .from('menu_item')
      .update({
        name: item.name,
        price: Number(item.price),
        category: item.category,
        image_url: item.image_url,
        sort_order: Number(item.sort_order) || 0,
        is_available: item.is_available,
      })
      .eq('id', item.id);

    if (error) {
      setError(`Item ${item.id}: ${error.message}`);
    } else {
      setMessage(`Item ${item.id} saved successfully.`);
      await fetchMenuItems();
    }

    setSavingId(null);
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Delete this menu item?');
    if (!confirmed) return;

    setDeletingId(id);
    setError('');
    setMessage('');

    const { error } = await supabase.from('menu_item').delete().eq('id', id);

    if (error) {
      setError(`Item ${id}: ${error.message}`);
    } else {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setMessage(`Item ${id} deleted successfully.`);
    }

    setDeletingId(null);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-500">
              FoodiefyCo Admin
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Menu Management</h1>
            <p className="mt-1 text-sm text-slate-500">
              Add, update, and arrange items shown in your front store.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Front Store
            </Link>
            <Link
              to="/admin"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Back to Admin Panel
            </Link>
            <Link
              to="/admin/menu"
              className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Menu
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              Sign Out
            </button>
            <div className="flex justify-center lg:justify-end">
              <AdminThemeSwitcher />
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Add Menu Item</h2>
            <p className="text-sm text-slate-500">Lower sort order shows first.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                placeholder="Name"
                value={newItem.name}
                onChange={(e) => handleNewItemChange('name', e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Price</label>
              <input
                type="number"
                step="0.01"
                placeholder="Price"
                value={newItem.price}
                onChange={(e) => handleNewItemChange('price', e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
              <input
                type="text"
                placeholder="Category"
                value={newItem.category}
                onChange={(e) => handleNewItemChange('category', e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Image URL</label>
              <input
                type="text"
                placeholder="Image URL"
                value={newItem.image_url}
                onChange={(e) => handleNewItemChange('image_url', e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Sort Order</label>
              <input
                type="number"
                placeholder="Sort Order"
                value={newItem.sort_order}
                onChange={(e) => handleNewItemChange('sort_order', e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={newItem.is_available}
                onChange={(e) => handleNewItemChange('is_available', e.target.checked)}
                className="h-4 w-4"
              />
              Available
            </label>

            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-slate-400 sm:w-auto"
            >
              {creating ? 'Adding...' : 'Add Item'}
            </button>
          </div>

          {newItem.image_url ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-sm text-slate-600">Preview</p>
              <img
                src={newItem.image_url}
                alt={newItem.name || 'New menu item'}
                className="h-24 w-24 rounded-xl border border-slate-200 object-cover"
              />
            </div>
          ) : null}
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-green-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl bg-white p-6 shadow-sm">Loading menu items...</div>
        ) : (
          <>
            <div className="space-y-4 lg:hidden">
              {items.map((item) => (
                <div key={item.id} className="rounded-3xl bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Item #{item.id}
                      </p>
                      <h3 className="mt-1 truncate text-lg font-semibold text-slate-900">
                        {item.name || 'Untitled item'}
                      </h3>
                    </div>

                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                      <input
                        type="text"
                        value={item.name || ''}
                        onChange={(e) => handleChange(item.id, 'name', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3"
                        placeholder="Name"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Price</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.price ?? ''}
                          onChange={(e) => handleChange(item.id, 'price', e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-4 py-3"
                          placeholder="Price"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Sort Order</label>
                        <input
                          type="number"
                          value={item.sort_order ?? 0}
                          onChange={(e) => handleChange(item.id, 'sort_order', e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-4 py-3"
                          placeholder="Sort Order"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
                      <input
                        type="text"
                        value={item.category || ''}
                        onChange={(e) => handleChange(item.id, 'category', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3"
                        placeholder="Category"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Image URL</label>
                      <input
                        type="text"
                        value={item.image_url || ''}
                        onChange={(e) => handleChange(item.id, 'image_url', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3"
                        placeholder="Image URL"
                      />
                    </div>

                    <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={!!item.is_available}
                        onChange={(e) => handleChange(item.id, 'is_available', e.target.checked)}
                        className="h-4 w-4"
                      />
                      Available
                    </label>

                    {item.image_url ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="mb-2 text-sm text-slate-600">Preview</p>
                        <img
                          src={item.image_url}
                          alt={item.name || 'Menu item preview'}
                          className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => handleSave(item)}
                      disabled={savingId === item.id}
                      className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-400"
                    >
                      {savingId === item.id ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-slate-400"
                    >
                      {deletingId === item.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-3xl bg-white shadow-sm lg:block">
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Price</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Image URL</th>
                    <th className="px-4 py-3 text-center">Preview</th>
                    <th className="px-4 py-3 text-center">Sort Order</th>
                    <th className="px-4 py-3 text-center">Available</th>
                    <th className="px-4 py-3 text-center">Save</th>
                    <th className="px-4 py-3 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200 align-top">
                      <td className="px-4 py-3">{item.id}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.name || ''}
                          onChange={(e) => handleChange(item.id, 'name', e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={item.price ?? ''}
                          onChange={(e) => handleChange(item.id, 'price', e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.category || ''}
                          onChange={(e) => handleChange(item.id, 'category', e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.image_url || ''}
                          onChange={(e) => handleChange(item.id, 'image_url', e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="mx-auto h-14 w-14 rounded-xl object-cover"
                          />
                        ) : (
                          <span className="text-slate-400">No image</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={item.sort_order ?? 0}
                          onChange={(e) => handleChange(item.id, 'sort_order', e.target.value)}
                          className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-center"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!item.is_available}
                          onChange={(e) => handleChange(item.id, 'is_available', e.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleSave(item)}
                          disabled={savingId === item.id}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:bg-slate-400"
                        >
                          {savingId === item.id ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="rounded-xl bg-red-600 px-4 py-2 text-white transition hover:bg-red-700 disabled:bg-slate-400"
                        >
                          {deletingId === item.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
