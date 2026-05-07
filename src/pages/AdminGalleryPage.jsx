import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

function AdminGalleryPage() {
  const emptyForm = {
    title: '',
    imageUrl: '',
    targetUrl: '',
    sortOrder: 0,
    isActive: true,
  };

  const [form, setForm] = useState(emptyForm);
  const [galleryItems, setGalleryItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchGalleryItems = async () => {
    setLoading(true);
    setActionError('');

    const { data, error } = await supabase
      .from('gallery_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      setActionError(error.message);
      setLoading(false);
      return;
    }

    setGalleryItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchGalleryItems();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    setSuccessMessage('');

    if (!form.imageUrl.trim()) {
      setActionError('Image URL is required.');
      return;
    }

    setSaving(true);

    const payload = {
      title: form.title.trim() || null,
      image_url: form.imageUrl.trim(),
      target_url: form.targetUrl.trim() || null,
      sort_order: Number(form.sortOrder || 0),
      is_active: Boolean(form.isActive),
    };

    let response;

    if (editingId) {
      response = await supabase.from('gallery_items').update(payload).eq('id', editingId);
    } else {
      response = await supabase.from('gallery_items').insert([payload]);
    }

    if (response.error) {
      setActionError(response.error.message);
      setSaving(false);
      return;
    }

    setSuccessMessage(editingId ? 'Gallery item updated.' : 'Gallery item added.');
    resetForm();
    await fetchGalleryItems();
    setSaving(false);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      imageUrl: item.image_url || '',
      targetUrl: item.target_url || '',
      sortOrder: Number(item.sort_order || 0),
      isActive: Boolean(item.is_active),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Delete this gallery item?');
    if (!confirmed) return;

    setActionError('');
    setSuccessMessage('');

    const { error } = await supabase.from('gallery_items').delete().eq('id', id);

    if (error) {
      setActionError(error.message);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setSuccessMessage('Gallery item deleted.');
    await fetchGalleryItems();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gallery Admin</h1>
            <p className="mt-2 text-sm text-gray-500">
              Paste public S3 image URLs and optional hyperlinks for the gallery page.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/admin" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">
              Admin Page
            </Link>
            <Link to="/admin" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">
              Orders
            </Link>
            <Link to="/admin/menu" className="rounded-md bg-white px-4 py-2 text-gray-700 shadow hover:bg-gray-100">
              Menu
            </Link>
            <Link to="/gallery" className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-800">
              View Gallery
            </Link>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">
            {editingId ? 'Edit Gallery Item' : 'Add Gallery Item'}
          </h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">Image URL</label>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://your-public-bucket.s3.amazonaws.com/image.jpg"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Title / Caption</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Optional title"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Link URL</label>
              <input
                type="url"
                value={form.targetUrl}
                onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
                placeholder="Optional hyperlink when image is clicked"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <label className="inline-flex items-center gap-3 rounded-md border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active in gallery
              </label>
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : editingId ? 'Update Item' : 'Add Item'}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 transition hover:bg-gray-200"
              >
                Clear
              </button>
            </div>
          </form>

          {actionError && (
            <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700">
              {actionError}
            </div>
          )}

          {successMessage && (
            <div className="mt-4 rounded-md border border-green-300 bg-green-50 p-3 text-green-700">
              {successMessage}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Gallery Items</h2>
            <span className="text-sm text-gray-500">{galleryItems.length} item(s)</span>
          </div>

          {loading ? (
            <p className="text-gray-600">Loading gallery items...</p>
          ) : galleryItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-gray-500">
              No gallery items yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {galleryItems.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="aspect-[4/3] bg-gray-100">
                      <img
                        src={item.image_url}
                        alt={item.title || 'Gallery image'}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="p-4">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {item.title || 'Untitled'}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Sort: {item.sort_order ?? 0} · {item.is_active ? 'Active' : 'Hidden'}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600">
                        <p className="break-all">
                          <span className="font-semibold text-gray-800">Image:</span> {item.image_url}
                        </p>
                        <p className="break-all">
                          <span className="font-semibold text-gray-800">Link:</span> {item.target_url || 'None'}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <a
                          href={item.image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-blue-600 underline"
                        >
                          Open Image
                        </a>

                        {item.target_url && (
                          <a
                            href={item.target_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-semibold text-orange-600 underline"
                          >
                            Open Link
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminGalleryPage;
