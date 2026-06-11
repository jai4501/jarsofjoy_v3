import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import { Button3D } from './ui/Button3D';
import { FloatingCard } from './ui/FloatingCard';
import { Plus, Trash2, Edit3, Image as ImageIcon, Loader2, Check, X, AlertCircle, Search, Filter, Layers, Upload, RefreshCw, ChevronUp, ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';

type Product = Database['public']['Tables']['products']['Row'] & { 
  variations?: { name: string; price: number }[]
};

type ProductCategory = {
  id: string;
  name: string;
  emoji: string;
  sort_order: number;
  parent_id?: string | null;
  image_url?: string | null;
  is_active?: boolean | null;
};

export const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const { addToast } = useToastStore();
  const [dbHasParentId, setDbHasParentId] = useState(false);
  const [dbHasImageUrl, setDbHasImageUrl] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState('');
  const [active, setActive] = useState(true);
  const [variations, setVariations] = useState<{ name: string; price: number }[]>([]);
  const [uploading, setUploading] = useState(false);

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('🧁');
  const [newCatParentId, setNewCatParentId] = useState('');
  const [newCatImage, setNewCatImage] = useState('');
  const [newCatIsActive, setNewCatIsActive] = useState(true);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const startEditCategory = (cat: ProductCategory) => {
    setEditingCategoryId(cat.id);
    setNewCatName(cat.name);
    setNewCatEmoji(cat.emoji || '🧁');
    setNewCatParentId(cat.parent_id || '');
    setNewCatImage((cat as any).image_url || '');
    setNewCatIsActive((cat as any).is_active !== false);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setNewCatName('');
    setNewCatParentId('');
    setNewCatImage('');
    setNewCatEmoji('🧁');
    setNewCatIsActive(true);
  };

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchProducts(), fetchCategories()]);
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('product_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) setCategories(data as ProductCategory[]);
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true }); // Alphabetic sort by default
      
      if (error) throw error;
      if (data) setProducts(data as any);
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  useEffect(() => {
    fetchInitialData();
    const checkDbSchema = async () => {
      try {
        const { error: parentErr } = await supabase
          .from('product_categories')
          .select('parent_id')
          .limit(1);
        setDbHasParentId(!parentErr || parentErr.code !== '42703');

        const { error: imgErr } = await supabase
          .from('product_categories')
          .select('image_url')
          .limit(1);
        setDbHasImageUrl(!imgErr || imgErr.code !== '42703');
      } catch (err) {
        console.error('Failed to detect DB schema:', err);
      }
    };
    checkDbSchema();
  }, []);

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const catPayload: any = {
        name: newCatName.trim(),
        emoji: newCatEmoji,
        is_active: newCatIsActive
      };

      if (!editingCategoryId) {
        catPayload.sort_order = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order || 0)) + 1 : 1;
      }

      if (dbHasParentId) {
        catPayload.parent_id = newCatParentId || null;
      }
      if (dbHasImageUrl) {
        catPayload.image_url = newCatImage || null;
      }

      if (editingCategoryId) {
        const oldCat = categories.find(c => c.id === editingCategoryId);
        const oldName = oldCat ? oldCat.name : null;

        const { error } = await (supabase
          .from('product_categories') as any)
          .update(catPayload)
          .eq('id', editingCategoryId);
        if (error) throw error;

        // Cascade category name change to products
        if (oldName && oldName !== newCatName.trim()) {
          const { error: prodErr } = await (supabase
            .from('products') as any)
            .update({ category: newCatName.trim() })
            .eq('category', oldName);
          if (prodErr) {
            console.error('Failed to update product categories:', prodErr);
          }
        }
        
        addToast(`Category ${newCatName} updated!`, 'sweet');
        setEditingCategoryId(null);
      } else {
        const { error } = await (supabase
          .from('product_categories') as any)
          .insert([catPayload]);
        if (error) throw error;
        
        addToast(`Category ${newCatName} added!`, 'sweet');
      }
      
      setNewCatName('');
      setNewCatParentId('');
      setNewCatImage('');
      setNewCatEmoji('🧁');
      setNewCatIsActive(true);
      fetchCategories();
      fetchProducts(); // Refresh products to show updated category names
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const deleteCategoryRecord = async (id: string, name: string) => {
    if (!window.confirm(`Delete category "${name}"? This won't delete products, but they will become uncategorized.`)) return;
    try {
      const { error } = await supabase.from('product_categories').delete().eq('id', id);
      if (error) throw error;

      // Cascade delete: set products category to null
      const { error: prodErr } = await (supabase
        .from('products') as any)
        .update({ category: null })
        .eq('category', name);
      if (prodErr) {
        console.error('Failed to clear product categories:', prodErr);
      }

      fetchCategories();
      fetchProducts(); // Refresh products list
      addToast(`Category "${name}" deleted!`, 'sweet');
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const handleMoveCategory = async (catId: string, direction: 'up' | 'down') => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    
    const siblings = categories
      .filter(c => c.parent_id === cat.parent_id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      
    const index = siblings.findIndex(s => s.id === catId);
    if (index === -1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;
    
    const sibling = siblings[targetIndex];
    
    const siblingOrder = sibling.sort_order ?? (targetIndex + 1);
    const catOrder = cat.sort_order ?? (index + 1);
    
    const newCatOrder = siblingOrder === catOrder ? catOrder + (direction === 'up' ? -1 : 1) : siblingOrder;
    const newSiblingOrder = catOrder;
    
    try {
      const { error: err1 } = await (supabase
        .from('product_categories') as any)
        .update({ sort_order: newCatOrder })
        .eq('id', cat.id);
      if (err1) throw err1;
      
      const { error: err2 } = await (supabase
        .from('product_categories') as any)
        .update({ sort_order: newSiblingOrder })
        .eq('id', sibling.id);
      if (err2) throw err2;
      
      addToast('Order updated!', 'sweet');
      fetchCategories();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const getCategoryProductCount = (categoryName: string) => {
    return products.filter(p => p.category === categoryName).length;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newImages = [...images];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const filePath = `product-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('products')
          .getPublicUrl(filePath);

        newImages.push(publicUrl);
      }
      setImages(newImages);
      addToast('Images uploaded successfully!', 'sweet');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
    const productData = { 
      name, 
      description, 
      price: parseFloat(price), 
      category, 
      image: images[0] || '', // Legacy image field fallback
      images, // Primary source of truth
      tags: tagArray, 
      active,
      variations
    };

    try {
      if (editingProduct) {
        const { error } = await (supabase.from('products') as any)
          .update(productData)
          .eq('id', editingProduct.id);
        if (error) throw error;
        addToast('Treat updated successfully!', 'sweet');
      } else {
        const { error } = await (supabase.from('products') as any)
          .insert([productData]);
        if (error) throw error;
        addToast('New treat added!', 'sweet');
      }
      
      setShowModal(false);
      resetForm();
      fetchProducts();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setCategory('');
    setImages([]);
    setTags('');
    setActive(true);
    setVariations([]);
    setEditingProduct(null);
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setDescription(product.description || '');
    setPrice(product.price.toString());
    setCategory(product.category || '');
    setImages(product.images || []);
    setTags(product.tags?.join(', ') || '');
    setActive(product.active || false);
    setVariations((product as any).variations || []);
    setShowModal(true);
  };

  const addVariation = () => {
    setVariations([...variations, { name: '', price: 0 }]);
  };

  const updateVariation = (index: number, field: 'name' | 'price', value: string | number) => {
    const newVariations = [...variations];
    if (field === 'price') {
      newVariations[index].price = parseFloat(value as string) || 0;
    } else {
      newVariations[index].name = value as string;
    }
    setVariations(newVariations);
  };

  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently remove this treat from the menu?')) return;
    if (!window.confirm('WARNING: This action cannot be undone. Confirm deletion one last time?')) return;
    
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      addToast('Treat removed from menu', 'sweet');
      fetchProducts();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const deleteCategory = async () => {
    if (categoryFilter === 'All') {
      addToast('Please select a specific category to delete.', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ALL items in the "${categoryFilter}" category?`)) return;
    if (!window.confirm(`DANGER: This will permanently remove all products under "${categoryFilter}". Are you absolutely sure?`)) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('category', categoryFilter);
      
      if (error) throw error;
      addToast(`Category "${categoryFilter}" deleted successfully.`, 'sweet');
      setCategoryFilter('All');
      fetchProducts();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const categoryList = ['All', ...categories.map(c => c.name)].sort((a, b) => {
    if (a === 'All') return -1;
    if (b === 'All') return 1;
    return a.localeCompare(b);
  });

  const filteredProducts = products.filter(p => {
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalLive = products.filter(p => p.active).length;
  const categoryLive = filteredProducts.filter(p => p.active).length;

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="heading-serif text-5xl text-brand-dark mb-2">Menu Manager</h2>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-brand-dark/40 font-black uppercase tracking-[0.2em] text-[10px]">Curate your artisanal offerings</p>
            <div className="h-4 w-px bg-brand/10 hidden sm:block" />
            <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full border border-green-100">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
               <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">{totalLive} Live Treats</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 w-full sm:w-auto">
          <Button3D 
            variant="outline" 
            onClick={() => setShowCategoryModal(true)} 
            className="flex items-center gap-2 !h-14"
          >
            <Layers size={20} /> Manage Categories
          </Button3D>
          <Button3D onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 !h-14">
            <Plus size={20} /> New Treat
          </Button3D>
        </div>
      </div>

      {/* Filter Bar & Category Actions */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-brand/30 group-focus-within:text-brand transition-colors" size={20} />
            <input 
              type="text"
              placeholder="Search treats by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-16 pl-14 pr-6 bg-white rounded-2xl border-2 border-brand/5 shadow-soft outline-none focus:border-brand/20 transition-all font-bold text-brand-dark"
            />
          </div>
          
          <div className="relative w-full md:w-80 group">
            <Filter className="absolute left-5 top-1/2 -translate-y-1/2 text-brand/30 pointer-events-none" size={20} />
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-16 pl-14 pr-10 bg-white rounded-2xl border-2 border-brand/5 shadow-soft outline-none focus:border-brand/30 appearance-none font-bold text-brand-dark cursor-pointer"
            >
              {categoryList.map(cat => (
                <option key={cat} value={cat}>{cat} ({products.filter(p => (p.category || 'Uncategorized') === cat || (cat === 'All')).length})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-4 text-brand-dark/40 font-black text-[10px] uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-brand/40" />
              <span>{filteredProducts.length} Items found</span>
            </div>
            <div className="w-1 h-1 bg-brand/20 rounded-full" />
            <span>{categoryLive} Active</span>
          </div>

          {categoryFilter !== 'All' && (
            <button 
              onClick={deleteCategory}
              className="flex items-center gap-2 text-[9px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors px-4 py-2 rounded-xl bg-red-50/50 hover:bg-red-50 border border-red-100/50"
            >
              <Trash2 size={14} /> Delete Entire Category
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-40 gap-4 opacity-40">
          <Loader2 className="animate-spin text-brand" size={40} />
          <p className="font-black text-[10px] uppercase tracking-widest">Accessing Bakery Data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <AnimatePresence>
            {filteredProducts.map(product => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={product.id}
              >
                <FloatingCard className="!p-0 overflow-hidden border border-brand/5 h-full flex flex-col group relative">
                  {/* Action Buttons */}
                  <div className="absolute top-4 right-4 z-20 flex gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-all transform lg:translate-y-2 lg:group-hover:translate-y-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); startEdit(product); }} 
                      className="p-3 bg-white/95 backdrop-blur-md rounded-2xl text-brand hover:bg-brand hover:text-white transition-all shadow-xl border border-brand/10"
                      title="Edit Product"
                    >
                      <Edit3 size={20} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }} 
                      className="p-3 bg-white/95 backdrop-blur-md rounded-2xl text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-xl border border-red-100"
                      title="Delete Product"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  {/* Image Container */}
                  <div className="h-52 bg-brand-light/5 relative overflow-hidden shrink-0">
                    {product.images && product.images.length > 0 ? (
                      <img src={product.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={product.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl opacity-10">🧁</div>
                    )}
                    <div className="absolute bottom-3 left-3">
                       <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md border ${product.active ? 'bg-green-500 text-white border-green-400' : 'bg-red-500 text-white border-red-400'}`}>
                          {product.active ? 'Live' : 'Hidden'}
                       </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-8 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand/40">{product.category}</span>
                    </div>
                    <h4 className="text-2xl font-black text-brand-dark mb-4 leading-tight group-hover:text-brand transition-colors line-clamp-2">{product.name}</h4>
                    
                    <div className="mt-auto pt-6 border-t border-brand/5 flex items-center justify-between">
                      <p className="text-brand font-black text-3xl tracking-tighter">₹{product.price}</p>
                      <div className="flex flex-wrap justify-end gap-1.5 max-w-[120px]">
                        {product.tags?.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[8px] font-black text-brand/30 uppercase border border-brand/10 px-2 py-1 rounded-lg bg-brand/5">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </FloatingCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="fluid-glass w-full max-w-2xl p-8 sm:p-12 rounded-[4rem] shadow-layer-3 border border-white/60 my-auto"
            >
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-4xl font-black text-brand-dark flex items-center gap-4">
                   <div className="w-12 h-12 bg-brand text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand/20">
                    {editingProduct ? <Edit3 size={24}/> : <Plus size={24}/>}
                   </div>
                   {editingProduct ? 'Update Treat' : 'Add Creation'}
                </h3>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="w-12 h-12 rounded-full bg-brand/5 text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-all">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-4">Treat Name</label>
                    <input placeholder="Ex: Classic Fudge Jar" value={name} onChange={e => setName(e.target.value)} className="w-full h-16 bg-white border-2 border-brand-light/10 rounded-3xl px-6 outline-none font-bold text-brand-dark focus:border-brand transition-all shadow-inner" required />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-4">Category</label>
                    <select 
                      value={category} 
                      onChange={e => setCategory(e.target.value)} 
                      className="w-full h-16 bg-white border-2 border-brand-light/10 rounded-3xl px-6 outline-none font-bold text-brand-dark focus:border-brand transition-all shadow-inner appearance-none" 
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-4">Description</label>
                  <textarea placeholder="Describe the flavors and layers..." value={description} onChange={e => setDescription(e.target.value)} className="w-full p-6 bg-white border-2 border-brand-light/10 rounded-3xl outline-none font-bold text-brand-dark focus:border-brand transition-all shadow-inner resize-none" rows={3} required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-4">Base Price (₹)</label>
                    <input placeholder="0.00" type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full h-16 bg-white border-2 border-brand-light/10 rounded-3xl px-6 outline-none font-bold text-brand-dark focus:border-brand transition-all shadow-inner" required />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30 ml-4">Tags</label>
                    <input placeholder="Eggless, Bestseller, Trending" value={tags} onChange={e => setTags(e.target.value)} className="w-full h-16 bg-white border-2 border-brand-light/10 rounded-3xl px-6 outline-none font-bold text-brand-dark focus:border-brand transition-all shadow-inner" />
                  </div>
                </div>

                {/* Multi-Image Upload Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/30">Product Images</label>
                    <label className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all px-4 py-2 rounded-xl ${uploading ? 'bg-brand/10 text-brand' : 'bg-brand text-white shadow-lg shadow-brand/20 hover:scale-105'}`}>
                      {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                      {uploading ? 'Uploading...' : 'Add Images'}
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 p-4 bg-brand-light/5 rounded-3xl border border-brand/5">
                    {images.map((img, idx) => (
                      <div key={idx} className="aspect-square relative group rounded-2xl overflow-hidden border-2 border-white shadow-sm hover:border-brand transition-all">
                        <img src={img} className="w-full h-full object-cover" alt={`Product ${idx}`} />
                        <div className="absolute inset-0 bg-brand-dark/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                           <button type="button" onClick={() => removeImage(idx)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-lg">
                             <Trash2 size={14} />
                           </button>
                        </div>
                        {idx === 0 && <span className="absolute bottom-1 left-1 right-1 bg-brand text-white text-[6px] font-black text-center py-0.5 rounded-md uppercase tracking-tighter shadow-sm">Primary</span>}
                      </div>
                    ))}
                    {images.length === 0 && !uploading && (
                      <div className="col-span-full py-10 flex flex-col items-center justify-center gap-3 opacity-20 italic">
                        <ImageIcon size={32} />
                        <p className="text-[10px] font-bold">No images uploaded yet</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-6 bg-brand/5 rounded-3xl border border-brand/10">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                      {active ? <Check size={20}/> : <AlertCircle size={20}/>}
                    </div>
                    <div>
                      <p className="font-black text-xs text-brand-dark uppercase tracking-widest">Visibility Status</p>
                      <p className="text-[10px] font-bold text-brand-dark/40">Item will be {active ? 'visible' : 'hidden'} on storefront</p>
                    </div>
                  </div>
                  <div 
                    onClick={() => setActive(!active)}
                    className={`w-16 h-8 rounded-full p-1 cursor-pointer transition-colors relative ${active ? 'bg-brand' : 'bg-gray-300'}`}
                  >
                    <motion.div 
                      animate={{ x: active ? 32 : 0 }}
                      className="w-6 h-6 bg-white rounded-full shadow-md"
                    />
                  </div>
                </div>

                {/* Variations Section */}
                <div className="space-y-4 border-t border-brand/5 pt-6">
                  <div className="flex justify-between items-center px-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-dark/40">Product Variations</label>
                    <button type="button" onClick={addVariation} className="flex items-center gap-1 text-[9px] font-black text-brand uppercase tracking-widest bg-brand/5 px-3 py-1.5 rounded-lg border border-brand/10 hover:bg-brand hover:text-white transition-all">
                      <Plus size={12} /> Add Size/Weight
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {variations.map((v, i) => (
                      <div key={i} className="flex gap-3">
                        <input 
                          placeholder="Name (Ex: 250g)" 
                          value={v.name} 
                          onChange={e => updateVariation(i, 'name', e.target.value)} 
                          className="flex-[1.5] h-12 bg-white/50 border-2 border-brand-light/10 rounded-xl px-4 outline-none font-bold text-sm text-brand-dark focus:border-brand transition-all"
                        />
                        <input 
                          placeholder="Price (₹)" 
                          type="number" 
                          value={v.price} 
                          onChange={e => updateVariation(i, 'price', e.target.value)} 
                          className="flex-1 h-12 bg-white/50 border-2 border-brand-light/10 rounded-xl px-4 outline-none font-bold text-sm text-brand-dark focus:border-brand transition-all"
                        />
                        <button type="button" onClick={() => removeVariation(i)} className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-100">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    {variations.length === 0 && (
                      <p className="text-[10px] text-brand-dark/20 italic text-center py-4 border-2 border-dashed border-brand/5 rounded-2xl">No variations added (using base price only)</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-6 pt-4">
                  <Button3D variant="outline" className="flex-1 !h-16" onClick={() => { setShowModal(false); resetForm(); }}>Discard Changes</Button3D>
                  <Button3D className="flex-[1.5] !h-16">
                    {editingProduct ? 'Confirm Updates' : 'Launch Treat'}
                  </Button3D>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Management Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xl z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              className="fluid-glass w-full max-w-5xl p-6 sm:p-8 rounded-[2.5rem] shadow-luxury border border-white/60 flex flex-col max-h-[90vh] md:max-h-[85vh] bg-cream/95 overflow-hidden"
            >
               {/* Modal Header */}
               <div className="flex justify-between items-center mb-6 shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shadow-inner">
                        <Folder size={24} />
                     </div>
                     <div>
                        <h3 className="heading-serif text-2xl sm:text-3xl text-brand-dark">Category Architect</h3>
                        <p className="text-brand-dark/45 font-bold uppercase tracking-widest text-[8px] sm:text-[9px]">Configure & sequence your sweet folders</p>
                     </div>
                  </div>
                  <button 
                    onClick={() => { setShowCategoryModal(false); cancelEditCategory(); }} 
                    className="w-10 h-10 rounded-full bg-brand/5 text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-all shadow-sm shrink-0"
                  >
                    <X size={18} />
                  </button>
               </div>
               
               {/* Modal Body: Two Column Layout */}
               <div className="grid grid-cols-1 md:grid-cols-12 gap-6 overflow-hidden flex-grow min-h-0">
                  {/* Left Column: Category Tree Hierarchy (7 cols) */}
                  <div className="md:col-span-7 flex flex-col min-h-0 bg-white/40 border border-white rounded-[2rem] p-5">
                     <div className="flex items-center justify-between mb-4 shrink-0 px-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/50">Active Hierarchy</p>
                        <span className="text-[9px] font-bold text-brand bg-brand/5 px-2.5 py-1 rounded-full border border-brand/10">
                           {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
                        </span>
                     </div>
                     
                     <div className="space-y-4 overflow-y-auto pr-1 flex-grow custom-scrollbar">
                        {categories.filter(c => !c.parent_id).map(parentCat => {
                          const subCats = categories.filter(sub => sub.parent_id === parentCat.id);
                          const parentCount = getCategoryProductCount(parentCat.name);
                          const totalProductCountInBranch = parentCount + subCats.reduce((acc, sub) => acc + getCategoryProductCount(sub.name), 0);
                          
                          const parentCategories = categories.filter(c => !c.parent_id);
                          const isFirstParent = parentCategories[0]?.id === parentCat.id;
                          const isLastParent = parentCategories[parentCategories.length - 1]?.id === parentCat.id;

                          return (
                            <div key={parentCat.id} className="space-y-2 group/branch">
                              {/* Parent Category Card */}
                              <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${editingCategoryId === parentCat.id ? 'bg-brand/5 border-brand/20 shadow-soft' : 'bg-white/80 border-white hover:border-brand/10 hover:shadow-soft'}`}>
                                 <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-brand/5 flex items-center justify-center overflow-hidden shadow-inner shrink-0">
                                      {parentCat.image_url ? (
                                        <img src={parentCat.image_url} className="w-full h-full object-cover" alt={parentCat.name} />
                                      ) : (
                                        <span className="text-xl">{parentCat.emoji || '🧁'}</span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                       <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-black text-brand-dark text-sm truncate">{parentCat.name}</span>
                                          {parentCat.is_active === false ? (
                                            <span className="text-[6px] font-black uppercase text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100 shrink-0">Hidden</span>
                                          ) : (
                                            <span className="text-[6px] font-black uppercase text-green-500 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100 shrink-0">Live</span>
                                          )}
                                       </div>
                                       <span className="text-[8px] font-black uppercase text-brand/50 tracking-wider flex items-center gap-1 mt-0.5">
                                          Main Category <span className="text-brand-dark/20">•</span> 
                                          <span className="text-brand-dark/45 font-bold">
                                            {subCats.length > 0 ? `${parentCount} direct / ${totalProductCountInBranch} branch` : `${parentCount} treats`}
                                          </span>
                                       </span>
                                    </div>
                                 </div>
                                 
                                 {/* Toolbar */}
                                 <div className="flex items-center gap-1 shrink-0 bg-white/90 p-1 rounded-xl border border-brand/5 shadow-sm opacity-60 group-hover/branch:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => handleMoveCategory(parentCat.id, 'up')} 
                                      disabled={isFirstParent}
                                      className={`p-1.5 rounded-lg transition-all ${isFirstParent ? 'text-gray-200 cursor-not-allowed' : 'text-brand-dark/40 hover:text-brand hover:bg-brand/5'}`}
                                      title="Move Up"
                                    >
                                      <ChevronUp size={14}/>
                                    </button>
                                    <button 
                                      onClick={() => handleMoveCategory(parentCat.id, 'down')} 
                                      disabled={isLastParent}
                                      className={`p-1.5 rounded-lg transition-all ${isLastParent ? 'text-gray-200 cursor-not-allowed' : 'text-brand-dark/40 hover:text-brand hover:bg-brand/5'}`}
                                      title="Move Down"
                                    >
                                      <ChevronDown size={14}/>
                                    </button>
                                    <div className="w-px h-4 bg-brand/10 mx-0.5" />
                                    <button onClick={() => startEditCategory(parentCat)} className="p-1.5 text-brand hover:bg-brand/10 rounded-lg transition-all" title="Edit Category"><Edit3 size={14}/></button>
                                    <button onClick={() => deleteCategoryRecord(parentCat.id, parentCat.name)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all" title="Delete Category"><Trash2 size={14}/></button>
                                 </div>
                              </div>

                              {/* Sub-categories */}
                              {subCats.length > 0 ? (
                                <div className="pl-6 border-l-2 border-dashed border-brand/15 ml-5 py-1 space-y-2">
                                  {subCats.map(subCat => {
                                    const subCount = getCategoryProductCount(subCat.name);
                                    const isFirstSub = subCats[0]?.id === subCat.id;
                                    const isLastSub = subCats[subCats.length - 1]?.id === subCat.id;
                                    return (
                                      <div key={subCat.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all relative group/sub ${editingCategoryId === subCat.id ? 'bg-brand/5 border-brand/20 shadow-soft' : 'bg-white/55 border-white hover:border-brand/10 hover:shadow-soft'}`}>
                                         {/* Connection connector mark */}
                                         <span className="absolute -left-[16px] top-1/2 -translate-y-1/2 text-brand/25 font-bold text-sm">↳</span>
                                         
                                         <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-white border border-brand/5 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                                              {subCat.image_url ? (
                                                <img src={subCat.image_url} className="w-full h-full object-cover" alt={subCat.name} />
                                              ) : (
                                                <span className="text-base">{subCat.emoji || '🧁'}</span>
                                              )}
                                            </div>
                                            <div className="min-w-0">
                                               <div className="flex items-center gap-1.5 flex-wrap">
                                                  <span className="font-bold text-brand-dark text-xs truncate">{subCat.name}</span>
                                                  {subCat.is_active === false ? (
                                                    <span className="text-[5px] font-black uppercase text-red-500 bg-red-50 px-1 py-0.5 rounded-full border border-red-100 shrink-0">Hidden</span>
                                                  ) : (
                                                    <span className="text-[5px] font-black uppercase text-green-500 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100 shrink-0">Live</span>
                                                  )}
                                                  <span className="text-[8px] font-semibold text-brand-dark/45 shrink-0">{subCount} treats</span>
                                               </div>
                                            </div>
                                         </div>
                                         
                                         {/* Sub Toolbar */}
                                         <div className="flex items-center gap-0.5 shrink-0 bg-white/95 p-0.5 rounded-lg border border-brand/5 shadow-sm opacity-40 group-hover/sub:opacity-100 transition-opacity">
                                            <button 
                                              onClick={() => handleMoveCategory(subCat.id, 'up')} 
                                              disabled={isFirstSub}
                                              className={`p-1 rounded transition-all ${isFirstSub ? 'text-gray-200 cursor-not-allowed' : 'text-brand-dark/40 hover:text-brand hover:bg-brand/5'}`}
                                              title="Move Up"
                                            >
                                              <ChevronUp size={12}/>
                                            </button>
                                            <button 
                                              onClick={() => handleMoveCategory(subCat.id, 'down')} 
                                              disabled={isLastSub}
                                              className={`p-1 rounded transition-all ${isLastSub ? 'text-gray-200 cursor-not-allowed' : 'text-brand-dark/40 hover:text-brand hover:bg-brand/5'}`}
                                              title="Move Down"
                                            >
                                              <ChevronDown size={12}/>
                                            </button>
                                            <div className="w-px h-3 bg-brand/10 mx-0.5" />
                                            <button onClick={() => startEditCategory(subCat)} className="p-1 text-brand hover:bg-brand/10 rounded transition-all" title="Edit Sub-Category"><Edit3 size={12}/></button>
                                            <button onClick={() => deleteCategoryRecord(subCat.id, subCat.name)} className="p-1 text-red-400 hover:bg-red-50 rounded transition-all" title="Delete Sub-Category"><Trash2 size={12}/></button>
                                         </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}

                        {categories.length === 0 && (
                          <div className="flex flex-col items-center justify-center p-12 text-center bg-white/20 rounded-2xl border border-white border-dashed text-brand-dark/40 font-bold text-xs uppercase tracking-widest gap-2">
                            <Folder size={32} className="opacity-30 text-brand" />
                            <span>No categories created yet</span>
                          </div>
                        )}
                     </div>
                  </div>

                  {/* Right Column: Add/Edit Category Form (5 cols) */}
                  <div className="md:col-span-5 flex flex-col min-h-0">
                     <p className="text-[10px] font-black uppercase tracking-widest text-brand-dark/50 mb-4 shrink-0 px-1">
                        {editingCategoryId ? 'Modify Sweet Category' : 'Design New Category'}
                     </p>
                     
                     <div className="bg-white/40 border border-white rounded-[2rem] p-5 space-y-4 shadow-sm flex flex-col overflow-y-auto max-h-full pr-1 custom-scrollbar">
                        {/* Live Preview Widget */}
                        <div className="space-y-1.5 text-left shrink-0">
                           <label className="text-[8px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">Real-time Storefront Preview</label>
                           <div className="premium-card p-5 flex items-center justify-between relative overflow-hidden bg-white/80 border border-white rounded-2xl min-h-[90px] shadow-sm select-none">
                              <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-brand/5 rounded-full pointer-events-none" />
                              
                              <div className="flex items-center gap-3.5 relative z-10 text-left min-w-0">
                                <div className="w-12 h-12 bg-blush rounded-xl flex items-center justify-center overflow-hidden shadow-inner border border-white shrink-0">
                                  {newCatImage ? (
                                    <img src={newCatImage} className="w-full h-full object-cover" alt="Preview" />
                                  ) : (
                                    <span className="text-3xl">{newCatEmoji || '🧁'}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[7px] font-black uppercase tracking-[0.25em] text-brand mb-0.5">
                                     Curated Selection <span className="mx-0.5 text-brand/20">•</span> {getCategoryProductCount(newCatName || 'New Category')} treats
                                  </p>
                                  <h3 className="heading-serif text-lg text-brand-dark leading-none truncate pr-2">
                                    {newCatName.trim() || 'Category Name'}
                                  </h3>
                                  <p className="text-brand-dark/50 text-[9px] font-medium mt-1.5 truncate max-w-[190px]">
                                    Explore our premium {newCatName.trim() ? newCatName.toLowerCase() : 'new'} range.
                                  </p>
                                </div>
                              </div>
                              <div className="w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center shadow-soft shrink-0">
                                <ChevronRight size={16} />
                              </div>
                           </div>
                        </div>

                        {/* Name Input */}
                        <div className="space-y-1.5 text-left shrink-0">
                           <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">Category Name</label>
                           <input 
                             placeholder="e.g. Tres Leches" 
                             value={newCatName} 
                             onChange={e => setNewCatName(e.target.value)} 
                             className="w-full h-11 bg-white border border-brand/10 focus:border-brand/35 rounded-xl px-4 font-bold outline-none shadow-inner text-sm" 
                           />
                        </div>

                        {/* Emoji Picker Presets */}
                        <div className="space-y-1.5 text-left shrink-0">
                           <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">
                             Select Icon Emoji: <span className="text-brand font-black text-sm ml-1">{newCatEmoji}</span>
                           </label>
                           <div className="grid grid-cols-6 gap-1.5 bg-white/50 p-2.5 rounded-xl border border-brand/5 shadow-inner">
                              {['🧁', '🍰', '🍪', '🍫', '🥛', '🎂', '🍩', '🍯', '🍞', '🥧', '🍦', '🥞'].map(em => (
                                <button
                                  key={em}
                                  type="button"
                                  onClick={() => setNewCatEmoji(em)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all hover:scale-110 ${newCatEmoji === em ? 'bg-brand text-white shadow-soft scale-105 border border-brand/10' : 'bg-white hover:bg-brand/5 text-brand-dark/70'}`}
                                >
                                  {em}
                                </button>
                              ))}
                           </div>
                        </div>

                        {/* Parent Category Selector */}
                        {dbHasParentId && (
                          <div className="space-y-1.5 text-left shrink-0">
                             <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">Parent Category</label>
                             <div className="relative">
                               <select 
                                 value={newCatParentId} 
                                 onChange={e => setNewCatParentId(e.target.value)}
                                 className="w-full h-11 bg-white border border-brand/10 focus:border-brand/35 rounded-xl px-4 font-bold outline-none shadow-inner appearance-none text-xs text-brand-dark"
                               >
                                 <option value="">No Parent (Main Category)</option>
                                 {categories.filter(c => !c.parent_id && c.id !== editingCategoryId).map(c => (
                                   <option key={c.id} value={c.id}>{c.emoji} Sub of: {c.name}</option>
                                 ))}
                               </select>
                               <div className="absolute right-4 top-1/2 -translate-y-1/2 text-brand/30 pointer-events-none font-bold text-[10px]">▼</div>
                             </div>
                          </div>
                        )}

                        {/* Image URL Input */}
                        {dbHasImageUrl && (
                          <div className="space-y-1.5 text-left shrink-0">
                             <label className="text-[9px] font-black uppercase tracking-widest text-brand-dark/40 ml-2">Image Link (Optional)</label>
                             <div className="relative group">
                               <input 
                                 placeholder="https://images.unsplash.com/..." 
                                 value={newCatImage} 
                                 onChange={e => setNewCatImage(e.target.value)} 
                                 className="w-full h-11 bg-white border border-brand/10 focus:border-brand/35 rounded-xl px-4 pr-11 font-bold outline-none shadow-inner text-xs text-brand-dark" 
                               />
                               <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-brand/5 flex items-center justify-center overflow-hidden border border-brand/10 shadow-sm shrink-0">
                                 {newCatImage ? (
                                   <img src={newCatImage} className="w-full h-full object-cover" alt="preview" />
                                 ) : (
                                   <ImageIcon size={12} className="text-brand/30" />
                                 )}
                                </div>
                              </div>
                          </div>
                        )}

                        {/* Visibility Toggle Switch */}
                        <div className="flex items-center justify-between p-3.5 bg-brand/5 rounded-xl border border-brand/15 group shrink-0">
                           <span className="font-black text-[8px] sm:text-[9px] uppercase tracking-widest text-brand-dark/70">Show on Menu page</span>
                           <button 
                             type="button" 
                             onClick={() => setNewCatIsActive(!newCatIsActive)} 
                             className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${newCatIsActive ? 'bg-brand shadow-md' : 'bg-gray-200'}`}
                           >
                              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${newCatIsActive ? 'left-4.5' : 'left-0.5'}`} />
                           </button>
                        </div>

                        {/* Form Submission Buttons */}
                        <div className="flex gap-2.5 pt-1 shrink-0">
                           <Button3D 
                             onClick={handleSaveCategory} 
                             className="flex-grow !h-12 uppercase tracking-widest font-black text-[9px]"
                           >
                             {editingCategoryId ? 'Save Changes' : 'Create Category'}
                           </Button3D>
                           {editingCategoryId && (
                             <span title="Cancel Edit">
                               <Button3D 
                                 variant="outline" 
                                 onClick={cancelEditCategory} 
                                 className="!w-12 !h-12 shrink-0 animate-in fade-in zoom-in duration-200" 
                               >
                                 <X size={16}/>
                               </Button3D>
                             </span>
                           )}
                        </div>
                     </div>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
