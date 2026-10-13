'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import AuthShield from '@/components/AuthShield';
import ImageCropperModal from '@/components/ImageCropperModal';
import toast from 'react-hot-toast';
import { 
  Newspaper, 
  Plus, 
  Search, 
  ArrowLeft,
  X, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Crop, 
  Check, 
  Bold, 
  Italic, 
  Underline, 
  Heading2, 
  Quote, 
  Image as ImageIcon, 
  Film, 
  Layers, 
  Clock, 
  User, 
  Bookmark, 
  Zap, 
  PhoneCall, 
  Copy, 
  BookOpen, 
  Send,
  HelpCircle,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CornerDownLeft,
  ArrowUp
} from 'lucide-react';

// Minimalist Vector Bee Icon (No background, pure vector)
const BeeIcon = ({ className = "w-5 h-5", color = "#ffa200", ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    {/* Wings */}
    <path
      d="M9 11C6 7 2.5 8 3 12.5C3.5 16 7.5 14.5 9 13"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15 11C18 7 21.5 8 21 12.5C20.5 16 16.5 14.5 15 13"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Body / Abdomen */}
    <ellipse cx="12" cy="14" rx="3.6" ry="5.2" fill={color} stroke="currentColor" strokeWidth="1.6" />
    {/* Honeybee Stripes */}
    <path d="M8.8 12.5H15.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M8.6 15H15.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    {/* Head */}
    <circle cx="12" cy="7.2" r="2.4" fill="currentColor" />
    {/* Antennae */}
    <path d="M10.8 5.4C10.2 3.8 8.8 3.6 8 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M13.2 5.4C13.8 3.8 15.2 3.6 16 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    {/* Stinger */}
    <path d="M12 19.2V21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const SEED_ARTICLES = [
  {
    id: 'cashew-honey-perfection',
    slug: 'cashew-honey-perfection',
    type: 'blog',
    title: 'Cashew Honey: Nutty Sweet Perfection!',
    subtitle: 'Harvested from blooming cashew plantations across Northern Ghana, offering distinct floral undertones and natural enzymes.',
    content: `## A Taste of the Northern Savannahs\n\nCashew blossom honey is one of West Africa's best-kept secrets. Sourced directly from sustainably managed cashew orchards in Ghana's Upper West and Northern regions, this honey embodies rich amber clarity and a subtle, buttery sweetness.\n\n> "Every jar of Cashew Honey supports rural farm families who partner with our outgrower beekeeping program."\n\n### Why Raw Unfiltered Honey Matters\nCommercial honey is frequently over-heated, stripping it of its living bee propolis, pollen grains, and medicinal enzymes. At The Honey Palace, our raw harvesting protocol guarantees zero heat treatment and zero sugar adulteration. What the bees seal into the comb is exactly what arrives on your breakfast table.`,
    category: 'Varieties',
    subcategory: 'Northern Harvest',
    tags: ['Raw Honey', 'Cashew Honey', 'Organic', 'Northern Ghana'],
    author: 'Khatayon Buluse',
    authorRole: 'Master Beekeeper',
    readTime: '4 min read',
    imageUrl: 'https://images.unsplash.com/photo-1587049352851-8d4e89134a4c?auto=format&fit=crop&w=1200&q=80',
    link: '',
    isFeatured: true,
    isBreaking: false,
    isTopPick: true,
    status: 'Active',
    views: 124,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acacia-honey-elegance',
    slug: 'acacia-honey-elegance',
    type: 'blog',
    title: 'Acacia Honey: Pure Elegance in Every Drop!',
    subtitle: 'Renowned for its pale crystalline clarity, gentle floral bouquet, and uniquely low glycemic profile.',
    content: `## The Gentle Giant of Wild Nectars\n\nAcacia trees blossom in short, intense bursts across the Sahel fringe. Bees foraging on wild Acacia produce an exceptionally pure, light-hued nectar that remains fluid for months without rapid crystallization.\n\n### Health & Wellness Highlights\n- **Gentle on Digestion**: Mild natural acidity aids gut flora.\n- **Natural Sweetener**: Perfect in green teas and natural smoothies without overpowering delicate flavors.`,
    category: 'Varieties',
    subcategory: 'Wild Flora',
    tags: ['Acacia Honey', 'Health & Wellness', 'Sahel Flora'],
    author: 'Sarah Devis',
    authorRole: 'Quality & Sourcing Lead',
    readTime: '5 min read',
    imageUrl: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=1200&q=80',
    link: '',
    isFeatured: false,
    isBreaking: false,
    isTopPick: true,
    status: 'Active',
    views: 89,
    createdAt: new Date().toISOString()
  },
  {
    id: 'women-in-agriculture-uer',
    slug: 'women-in-agriculture-uer',
    type: 'news',
    title: 'Women in Agriculture Project Launched in Upper East',
    subtitle: 'Strategic launch to empower rural women through modern apiculture skills, combating local poverty and dry season unemployment.',
    content: `Ghana News Agency (GNA) reported on the official launch of the Women in Apiculture initiative across the Upper East Region. In collaboration with local farmer cooperatives, the project equips over 200 women with modern top-bar beehives, protective gear, and fair-trade buyback contracts through The Honey Palace Africa.`,
    category: 'Community',
    subcategory: 'Economic Empowerment',
    tags: ['Women Empowerment', 'Upper East', 'Apiculture', 'GNA'],
    author: 'Ghana News Agency (GNA)',
    authorRole: 'Syndicated Wire',
    readTime: '3 min read',
    imageUrl: 'https://ghanaiantimes.com.gh/wp-content/uploads/2025/09/Mr-Gideon-Awelana-Buluse-right-explaining-the-use-of-the-Beehives-to-dignitaries-after-the-launch-of-the-project.jpg',
    link: 'https://gna.org.gh/2025/09/women-in-agriculture-project-launched-in-upper-east/',
    isFeatured: true,
    isBreaking: true,
    isTopPick: true,
    status: 'Active',
    views: 310,
    createdAt: new Date().toISOString()
  },
  {
    id: 'honey-palace-dome-launch',
    slug: 'honey-palace-dome-launch',
    type: 'news',
    title: 'The Honey Palace Launched at Dome',
    subtitle: 'Official commissioning of the state-of-the-art honey processing and testing center in Dome, Accra.',
    content: `The Ghanaian Times featured the official commissioning of The Honey Palace's flagship processing and packaging hub located at Dome, Accra. Dignitaries and agricultural stakeholders toured the modern quality-assurance laboratory designed to meet FDA and international export standards.`,
    category: 'Launch',
    subcategory: 'Processing Facility',
    tags: ['Processing Hub', 'Dome Accra', 'FDA Standards', 'Ghanaian Times'],
    author: 'Ghanaian Times',
    authorRole: 'National Press',
    readTime: '4 min read',
    imageUrl: 'https://ghanaiantimes.com.gh/wp-content/uploads/2022/08/Honey-pix-Mr-Buluse-telling-his-story-at-the-launch.jpg',
    link: 'https://ghanaiantimes.com.gh/the-honey-palace-launched-at-dome/',
    isFeatured: false,
    isBreaking: false,
    isTopPick: true,
    status: 'Active',
    views: 450,
    createdAt: new Date().toISOString()
  },
  {
    id: 'mango-honey-sweetness',
    slug: 'mango-honey-sweetness',
    type: 'blog',
    title: "Mango Honey: A Taste of Ghana's Tropical Sweetness!",
    subtitle: 'Golden richness harvested from the lush fruit orchards of the Eastern Region during peak flowering.',
    content: `## Tropical Blossoms in a Jar\n\nMango blossom honey features a delightfully rounded, fruity profile. When mango groves burst into flower along the Volta basin, bees collect golden nectar that creates an unmistakable tropical aroma.\n\n### Culinary & Breakfast Notes\n- **Rich Warm Finish**: Adds tropical sunshine to morning granola, fresh fruit bowls, and herbal infusions.\n- **Unpasteurized**: Delivers active enzymes directly from the comb.`,
    category: 'Varieties',
    subcategory: 'Volta Orchards',
    tags: ['Mango Blossom', 'Tropical Honey', 'Volta Region'],
    author: 'Michael Smith',
    authorRole: 'Field Agronomist',
    readTime: '4 min read',
    imageUrl: 'https://images.unsplash.com/photo-1471943311424-646960669fbc?auto=format&fit=crop&w=1200&q=80',
    link: '',
    isFeatured: false,
    isBreaking: false,
    isTopPick: true,
    status: 'Active',
    views: 74,
    createdAt: new Date().toISOString()
  },
  {
    id: 'neem-honey-healing-elixir',
    slug: 'neem-honey-healing-elixir',
    type: 'blog',
    title: "Neem Honey: Northern Ghana's Healing Elixir!",
    subtitle: 'Dark, robust, and loaded with natural antibacterial compounds from wild medicinal Neem trees.',
    content: `## Pure Medicinal Potency\n\nNeem is celebrated across African and traditional medicine for its potent healing properties. Bees that forage on delicate white Neem blossoms distill these therapeutic qualities into a dark, molasses-like honey prized for sore throats, wound healing, and immune resilience.\n\n### Therapeutic Profile\n- **High Antioxidant Density**: Naturally deep amber color reflects high flavonoid concentrations.\n- **Natural Antibacterial Power**: Revered for respiratory soothing and daily wellness routines.`,
    category: 'Health',
    subcategory: 'Medicinal Potency',
    tags: ['Neem Honey', 'Natural Antibacterial', 'Immunity', 'Medicinal'],
    author: 'Jenney Cord',
    authorRole: 'Herbal Wellness Specialist',
    readTime: '5 min read',
    imageUrl: '/assets/product-bottle-05.jpg',
    link: '',
    isFeatured: true,
    isBreaking: false,
    isTopPick: false,
    status: 'Active',
    views: 185,
    createdAt: new Date().toISOString()
  },
  {
    id: 'giz-partnership-beekeeping',
    slug: 'giz-partnership-beekeeping',
    type: 'news',
    title: 'Honey Palace Africa & GIZ to Train 200 Women & Youth',
    subtitle: 'Strategic cooperation with GIZ to deliver impact-centric apiculture training in Northern Ghana.',
    content: `Access Agric reported on the collaborative initiative between GIZ and The Honey Palace Africa to impart climate-resilient beekeeping techniques to youth and women in rural agrarian districts.`,
    category: 'Partnerships',
    subcategory: 'Youth & Women Training',
    tags: ['GIZ', 'Development Partners', 'Youth in Agric', 'Access Agric'],
    author: 'Access Agric',
    authorRole: 'Agric Wire',
    readTime: '4 min read',
    imageUrl: 'https://images.unsplash.com/photo-1587049352851-8d4e89134a4c?auto=format&fit=crop&w=1200&q=80',
    link: 'https://accessagric.com/honey-palace-africa-giz-to-train-200-women-and-youth-in-beekeeping/',
    isFeatured: false,
    isBreaking: false,
    isTopPick: true,
    status: 'Active',
    views: 290,
    createdAt: new Date().toISOString()
  }
];

export default function BlogManagementPage() {
  const { roles, user } = useAuth();
  const { showConfirm } = useUI();

  // Page View Modes: 'list' (Directory) vs 'editor' (Full Whole-Page Editor)
  const [viewMode, setViewMode] = useState('list');
  const [activeMainTab, setActiveMainTab] = useState('blogs'); // 'blogs' | 'news'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Articles Data
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Image Cropper Modal State
  const [cropperModal, setCropperModal] = useState({
    isOpen: false,
    imageUrl: '',
    targetField: 'featured',
    title: 'Crop Image',
    subtitle: ''
  });

  // Story Form State
  const [form, setForm] = useState({
    type: 'blog',
    title: '',
    slug: '',
    subtitle: '',
    content: '',
    category: 'Varieties',
    subcategory: '',
    tagsInput: '',
    author: '',
    authorRole: '',
    readTime: '4 min read',
    imageUrl: '',
    link: '',
    isFeatured: false,
    isBreaking: false,
    isTopPick: false,
    status: 'Active'
  });

  // Real-time Firestore Sync
  useEffect(() => {
    let unsubscribe = () => {};

    if (db) {
      try {
        const q = collection(db, 'articles');
        unsubscribe = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const list = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() });
            });
            list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            setArticles(list);
          } else {
            setArticles(SEED_ARTICLES);
          }
          setLoading(false);
        }, (err) => {
          console.warn('Firestore snapshot fallback to seeds:', err);
          setArticles(SEED_ARTICLES);
          setLoading(false);
        });
      } catch (e) {
        console.error('Firestore init error:', e);
        setArticles(SEED_ARTICLES);
        setLoading(false);
      }
    } else {
      setArticles(SEED_ARTICLES);
      setLoading(false);
    }

    return () => unsubscribe();
  }, []);

  // Open Full-Page Editor for New Story
  const openNewStory = (type = 'blog') => {
    setIsEditing(false);
    setEditingId(null);
    setForm({
      type,
      title: '',
      slug: '',
      subtitle: '',
      content: '',
      category: type === 'blog' ? 'Varieties' : 'Community',
      subcategory: '',
      tagsInput: '',
      author: user?.full_name || 'The Honey Palace Desk',
      authorRole: 'Editor',
      readTime: '4 min read',
      imageUrl: '',
      link: '',
      isFeatured: false,
      isBreaking: false,
      isTopPick: true,
      status: 'Active'
    });
    setViewMode('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open Full-Page Editor to Edit Story
  const openEditStory = (article) => {
    setIsEditing(true);
    setEditingId(article.id);
    setForm({
      type: article.type || 'blog',
      title: article.title || '',
      slug: article.slug || '',
      subtitle: article.subtitle || '',
      content: article.content || '',
      category: article.category || 'Varieties',
      subcategory: article.subcategory || '',
      tagsInput: Array.isArray(article.tags) ? article.tags.join(', ') : '',
      author: article.author || '',
      authorRole: article.authorRole || '',
      readTime: article.readTime || '4 min read',
      imageUrl: article.imageUrl || '',
      link: article.link || '',
      isFeatured: !!article.isFeatured,
      isBreaking: !!article.isBreaking,
      isTopPick: article.isTopPick !== false,
      status: article.status || 'Active'
    });
    setViewMode('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTitleChange = (val) => {
    const slugified = val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setForm(prev => ({
      ...prev,
      title: val,
      slug: !isEditing ? slugified : prev.slug
    }));
  };

  const handleUseMyProfile = () => {
    setForm(prev => ({
      ...prev,
      author: user?.full_name || user?.email?.split('@')[0] || 'The Honey Palace Admin',
      authorRole: roles?.includes('Admin') ? 'Chief Executive' : (roles?.[0] || 'Staff Editor')
    }));
    toast.success('Applied your admin profile to byline!');
  };

  // Rich Formatting Toolbar Helper
  const applyFormat = (type) => {
    if (type === 'banner-image') {
      setCropperModal({
        isOpen: true,
        imageUrl: '',
        targetField: 'content-banner',
        title: 'Insert Banner Image into Article',
        subtitle: 'Paste an image link or pick a preset to embed a full-width story banner'
      });
      return;
    }

    if (type === 'wrap-image') {
      setCropperModal({
        isOpen: true,
        imageUrl: '',
        targetField: 'content-wrap',
        title: 'Insert Text-Wrap Image (Float Left)',
        subtitle: 'Paste an image link to wrap paragraph text around this photo'
      });
      return;
    }

    const textarea = document.getElementById('story-content-textarea');
    if (!textarea) return;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const selected = form.content.substring(start, end);

    let replacement = '';

    switch (type) {
      case 'bold':
        replacement = selected ? `**${selected}**` : '**bold text**';
        break;
      case 'italic':
        replacement = selected ? `*${selected}*` : '*italic text*';
        break;
      case 'underline':
        replacement = selected ? `<u>${selected}</u>` : '<u>underlined text</u>';
        break;
      case 'heading':
        replacement = selected ? `\n\n## ${selected}\n\n` : '\n\n## Section Heading\n\n';
        break;
      case 'quote':
        replacement = selected ? `\n\n> "${selected}"\n\n` : '\n\n> "Insightful quote about honey purity here"\n\n';
        break;
      case 'ussd':
        replacement = selected ? `\`*${selected.replace(/[^\d*#]/g, '')}#\`` : '`*920#`';
        break;
      case 'list':
        replacement = selected ? `\n- ${selected.replace(/\n/g, '\n- ')}\n` : '\n- Key benefit point 1\n- Key benefit point 2\n';
        break;
      case 'video':
        const videoUrl = prompt('Enter YouTube or Vimeo video URL:');
        if (videoUrl) {
          replacement = `\n\n[video](${videoUrl})\n\n`;
        } else {
          return;
        }
        break;
      default:
        return;
    }

    const newContent = form.content.substring(0, start) + replacement + form.content.substring(end);
    setForm(prev => ({ ...prev, content: newContent }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 50);
  };

  const handleApplyCroppedImage = (croppedUrl) => {
    if (!croppedUrl) return;

    if (cropperModal.targetField === 'featured') {
      setForm(prev => ({ ...prev, imageUrl: croppedUrl }));
      toast.success('Featured cover image updated!');
    } else if (cropperModal.targetField === 'content-banner') {
      const bannerTag = `\n\n![Story Banner](${croppedUrl})\n\n`;
      setForm(prev => ({ ...prev, content: prev.content + bannerTag }));
      toast.success('Banner image added to article content!');
    } else if (cropperModal.targetField === 'content-wrap') {
      const wrapTag = `\n\n<img src="${croppedUrl}" alt="Photo" class="float-left w-1/2 mr-4 mb-4 rounded-xl shadow-md" />\n\n`;
      setForm(prev => ({ ...prev, content: prev.content + wrapTag }));
      toast.success('Text-wrap image inserted into article!');
    }
  };

  // Save / Publish Story to Firestore
  const handleSaveStory = async (e) => {
    if (e) e.preventDefault();

    if (!form.title.trim()) {
      toast.error('Headline Title is required!');
      return;
    }

    if (!form.subtitle.trim()) {
      toast.error('Executive Summary / Excerpt is required!');
      return;
    }

    if (!form.content.trim() && !form.link.trim()) {
      toast.error('Please provide article body text or an external news source link!');
      return;
    }

    setSaving(true);

    const docId = isEditing ? editingId : (form.slug || `story-${Date.now()}`);
    const tagsArray = form.tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const storyData = {
      type: form.type,
      title: form.title.trim(),
      slug: form.slug.trim() || docId,
      subtitle: form.subtitle.trim(),
      content: form.content.trim(),
      category: form.category,
      subcategory: form.subcategory.trim(),
      tags: tagsArray,
      author: form.author.trim() || 'The Honey Palace Team',
      authorRole: form.authorRole.trim() || 'Editor',
      readTime: form.readTime.trim() || '4 min read',
      imageUrl: form.imageUrl.trim() || 'https://images.unsplash.com/photo-1587049352851-8d4e89134a4c?auto=format&fit=crop&w=1200&q=80',
      link: form.link.trim(),
      isFeatured: form.isFeatured,
      isBreaking: form.isBreaking,
      isTopPick: form.isTopPick,
      status: form.status,
      updatedAt: new Date().toISOString()
    };

    try {
      if (db) {
        const docRef = doc(db, 'articles', docId);
        if (isEditing) {
          await updateDoc(docRef, storyData);
          toast.success('Story updated successfully!');
        } else {
          storyData.createdAt = new Date().toISOString();
          storyData.views = 0;
          await setDoc(docRef, storyData);
          toast.success('Story published live to website!');
        }
      } else {
        if (isEditing) {
          setArticles(prev => prev.map(a => a.id === docId ? { ...a, ...storyData } : a));
          toast.success('Story updated (local fallback)!');
        } else {
          const newDoc = { id: docId, ...storyData, createdAt: new Date().toISOString(), views: 0 };
          setArticles(prev => [newDoc, ...prev]);
          toast.success('Story created (local fallback)!');
        }
      }

      setViewMode('list');
    } catch (err) {
      console.error('Save story failed:', err);
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (article) => {
    const newStatus = article.status === 'Active' ? 'Draft' : 'Active';
    try {
      if (db) {
        await updateDoc(doc(db, 'articles', article.id), { status: newStatus });
      } else {
        setArticles(prev => prev.map(a => a.id === article.id ? { ...a, status: newStatus } : a));
      }
      toast.success(`Story status changed to ${newStatus}`);
    } catch (err) {
      toast.error('Failed to change status: ' + err.message);
    }
  };

  const handleDeleteStory = (article) => {
    showConfirm({
      title: 'Delete Story?',
      message: `Are you sure you want to permanently delete "${article.title}"? This will remove it from the live website immediately.`,
      confirmLabel: 'Delete Forever',
      isDestructive: true,
      onConfirm: async () => {
        try {
          if (db) {
            await deleteDoc(doc(db, 'articles', article.id));
          } else {
            setArticles(prev => prev.filter(a => a.id !== article.id));
          }
          toast.success('Story deleted successfully.');
        } catch (err) {
          toast.error('Failed to delete story: ' + err.message);
        }
      }
    });
  };

  const handleCopyLink = (article) => {
    const url = `https://thehoneypalaceafrica.com/blog/${article.slug || article.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Website link copied to clipboard!');
  };

  const filteredArticles = articles.filter(a => {
    const matchesTab = activeMainTab === 'blogs' ? a.type === 'blog' : a.type === 'news';
    const matchesSearch = searchQuery === '' || 
      a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.author?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
    return matchesTab && matchesSearch && matchesStatus;
  });

  const totalBlogs = articles.filter(a => a.type === 'blog').length;
  const totalNews = articles.filter(a => a.type === 'news').length;

  return (
    <AuthShield permission="blog.manage" fallbackPermission="settings.manage">
      <div className="p-3.5 md:p-8 pb-36 md:pb-8 max-w-7xl mx-auto space-y-6 md:space-y-8 bg-white rounded-2xl border border-gray-100 shadow-sm text-[#111111] font-sans">
        
        {/* =========================================================================
            VIEW MODE 1: STORIES DIRECTORY (LIST / CARDS)
           ========================================================================= */}
        {viewMode === 'list' && (
          <div className="space-y-6">
            
            {/* Header & Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/50 flex items-center justify-center text-[#d07b00]">
                  <Newspaper className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                    Blog & News Hub
                  </h1>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Create, edit, and publish stories and press announcements to the live website
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => openNewStory('blog')}
                  className="px-4 py-2.5 bg-[#ffa200] hover:bg-[#e69100] text-black font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Blog Post</span>
                </button>
                <button
                  onClick={() => openNewStory('news')}
                  className="px-4 py-2.5 bg-black hover:bg-gray-800 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition active:scale-95 shadow-sm"
                >
                  <Plus className="w-4 h-4 text-[#ffa200]" />
                  <span>New News Story</span>
                </button>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/70 p-3 rounded-2xl border border-gray-200/80">
              
              {/* Category Segmented Controls */}
              <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-2xs w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMainTab('blogs');
                    setSearchQuery('');
                  }}
                  className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                    activeMainTab === 'blogs'
                      ? 'bg-[#ffa200] text-black shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Customer Blogs</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeMainTab === 'blogs' ? 'bg-black/15 text-black' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {totalBlogs}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMainTab('news');
                    setSearchQuery('');
                  }}
                  className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                    activeMainTab === 'news'
                      ? 'bg-[#ffa200] text-black shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Newspaper className="w-3.5 h-3.5" />
                  <span>News & Press</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeMainTab === 'news' ? 'bg-black/15 text-black' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {totalNews}
                  </span>
                </button>
              </div>

              {/* Search & Status Filter */}
              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${activeMainTab === 'blogs' ? 'blogs' : 'news'}...`}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200]"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 outline-none focus:border-[#ffa200] font-semibold"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active (Live)</option>
                  <option value="Draft">Drafts</option>
                </select>
              </div>
            </div>
                {/* Articles Grid */}
                {loading ? (
                  <div className="py-20 text-center text-gray-500 space-y-3">
                    <div className="w-8 h-8 border-2 border-[#ffa200] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs">Loading stories from live database...</p>
                  </div>
                ) : filteredArticles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    className="bg-white border border-gray-200 hover:border-[#ffa200]/60 rounded-2xl overflow-hidden flex flex-col justify-between transition duration-200 group shadow-xs hover:shadow-md"
                  >
                    <div>
                      {/* Image Thumbnail */}
                      <div className="relative h-44 w-full bg-gray-100 overflow-hidden">
                        <img
                          src={article.imageUrl || 'https://images.unsplash.com/photo-1587049352851-8d4e89134a4c?auto=format&fit=crop&w=800&q=80'}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />


                        <div className="absolute top-3 right-3">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-xs ${
                            article.status === 'Active'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            <span>{article.status}</span>
                          </span>
                        </div>

                        <div className="absolute bottom-2.5 right-3 text-[11px] text-white font-mono bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#ffa200]" />
                          <span>{article.readTime || '4 min read'}</span>
                        </div>
                      </div>

                      {/* Content Details */}
                      <div className="p-4 space-y-2.5">
                        <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-[#d07b00] transition">
                          {article.title}
                        </h3>
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                          {article.subtitle}
                        </p>

                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                          <div className="w-5 h-5 rounded-full bg-orange-100 text-[#d07b00] flex items-center justify-center font-bold text-[10px]">
                            {article.author ? article.author.charAt(0).toUpperCase() : 'H'}
                          </div>
                          <span className="font-semibold text-gray-700 truncate max-w-[130px]">
                            {article.author}
                          </span>
                          {article.authorRole && (
                            <span className="text-gray-400 truncate">
                              • {article.authorRole}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleStatus(article)}
                          className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition"
                          title={article.status === 'Active' ? 'Unpublish to Draft' : 'Publish Live'}
                        >
                          {article.status === 'Active' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        {article.link ? (
                          <a
                            href={article.link}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-gray-500 hover:text-[#ffa200] rounded-lg hover:bg-gray-200 transition"
                            title="Open External Press Link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <button
                            onClick={() => handleCopyLink(article)}
                            className="p-1.5 text-gray-500 hover:text-[#ffa200] rounded-lg hover:bg-gray-200 transition"
                            title="Copy Website Article Link"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditStory(article)}
                          className="px-3 py-1 bg-white hover:bg-gray-100 text-gray-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-gray-200 transition shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#d07b00]" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteStory(article)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          title="Delete Story"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center border border-dashed border-gray-200 rounded-2xl p-8 space-y-3">
                <Newspaper className="w-10 h-10 text-gray-300 mx-auto" />
                <h4 className="text-sm font-bold text-gray-800">
                  No {activeMainTab === 'blogs' ? 'blog posts' : 'news stories'} found
                </h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  {searchQuery
                    ? `No results match "${searchQuery}". Try a different keyword.`
                    : `Get started by creating your first ${activeMainTab === 'blogs' ? 'customer blog post' : 'news story'}!`}
                </p>
                <button
                  onClick={() => openNewStory(activeMainTab === 'blogs' ? 'blog' : 'news')}
                  className="mt-2 px-4 py-2 bg-[#ffa200] text-black font-bold text-xs rounded-xl inline-flex items-center gap-2 hover:bg-[#e69100] transition shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create {activeMainTab === 'blogs' ? 'Blog' : 'News'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            VIEW MODE 2: FULL WHOLE-PAGE SMART STORY EDITOR (WHITE BACKGROUND)
           ========================================================================= */}
        {viewMode === 'editor' && (
          <div className="space-y-6">
            
            {/* Top Navigation Bar: Back Button, Title, Story Type, Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl transition shadow-2xs"
                  title="Back to All Stories"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                    {isEditing ? 'Edit Story' : 'Create New Story'}
                  </h1>
                  <p className="text-xs text-gray-500">
                    Whole-page smart editor synced to The Honey Palace Africa website
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Story Type Segmented Pill */}
                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: 'blog' }))}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      form.type === 'blog' ? 'bg-[#ffa200] text-black shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Blog Post
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: 'news' }))}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      form.type === 'news' ? 'bg-[#ffa200] text-black shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    News / Press
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveStory}
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#ffa200] hover:bg-[#e69100] text-black font-bold text-xs rounded-xl transition shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Publishing...' : (isEditing ? 'Save Changes' : 'Publish Story Live')}
                </button>
              </div>
            </div>

            {/* =====================================================================
                MAIN EDITOR FORM (2 COLUMNS: 70% MAIN / 30% SIDEBAR)
               ===================================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* LEFT COLUMN (70%) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Headline & Summary Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
                  <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2.5">
                    Story Information
                  </h3>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Headline Title *
                    </label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="e.g. Cashew Honey: Nutty Sweet Perfection from Northern Savannas"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200]"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-gray-700">
                        Executive Summary / Card Excerpt *
                      </label>
                      <button
                        type="button"
                        onClick={() => handleSendAiPrompt('Auto-Generate Executive Summary')}
                        className="text-[11px] text-[#d07b00] hover:underline font-bold flex items-center gap-1.5"
                      >
                        <BeeIcon className="w-3.5 h-3.5 text-[#d07b00]" color="#ffa200" />
                        <span>AI Summarize</span>
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={form.subtitle}
                      onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                      placeholder="Brief 1-2 sentence hook displayed on homepage cards..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200] leading-relaxed"
                      required
                    />
                  </div>

                  {/* Categories & Tags */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Category *</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 outline-none focus:bg-white focus:border-[#ffa200]"
                      >
                        <option value="Varieties">Varieties (Honey Flavors)</option>
                        <option value="Health">Health & Wellness</option>
                        <option value="Beekeeping">Beekeeping & Apiculture</option>
                        <option value="Community">Community & Farmers</option>
                        <option value="Conservation">Conservation & Climate</option>
                        <option value="Launch">Launch & Facility</option>
                        <option value="Partnerships">Partnerships & GIZ</option>
                        <option value="Press">Press & Media</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Tags (Comma Separated)</label>
                      <input
                        type="text"
                        value={form.tagsInput}
                        onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
                        placeholder="Raw Honey, Cashew, Organic, Wellness"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-[#ffa200]"
                      />
                    </div>
                  </div>
                </div>

                {/* Featured Cover Image Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Featured Hero Cover Image</h3>
                      <p className="text-xs text-gray-500">Accepts Cloudinary, Unsplash, or direct image links</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCropperModal({
                        isOpen: true,
                        imageUrl: form.imageUrl || '',
                        targetField: 'featured',
                        title: 'Crop & Frame Featured Image',
                        subtitle: 'Format your cover photo for 16:9 lead story or 16:10 card presentation'
                      })}
                      className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-[#d07b00] border border-orange-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>{form.imageUrl ? 'Crop / Frame Image' : 'Pick / Crop Photo'}</span>
                    </button>
                  </div>

                  <div className="flex gap-3 items-center">
                    <input
                      type="url"
                      value={form.imageUrl}
                      onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                      placeholder="Paste image link: https://images.unsplash.com/... or https://res.cloudinary.com/..."
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-[#ffa200] font-mono"
                    />
                    {form.imageUrl && (
                      <div 
                        onClick={() => setCropperModal({
                          isOpen: true,
                          imageUrl: form.imageUrl,
                          targetField: 'featured',
                          title: 'Crop & Frame Featured Image',
                          subtitle: 'Fine-tune the crop frame and aspect ratio'
                        })}
                        className="relative w-16 h-12 rounded-xl overflow-hidden border border-gray-200 shrink-0 bg-gray-100 cursor-pointer group shadow-2xs"
                        title="Click to crop this image"
                      >
                        <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <Crop className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* External Link (if News) */}
                {form.type === 'news' && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 space-y-2 shadow-xs">
                    <label className="block text-xs font-bold text-gray-700">
                      External Media Source Link (Optional)
                    </label>
                    <p className="text-xs text-gray-500">
                      If this news article was published by external press (GNA, Ghanaian Times, etc.), paste the URL here.
                    </p>
                    <input
                      type="url"
                      value={form.link}
                      onChange={(e) => setForm({ ...form, link: e.target.value })}
                      placeholder="https://gna.org.gh/2025/09/women-in-agriculture... or https://ghanaiantimes.com.gh/..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-[#ffa200] font-mono"
                    />
                  </div>
                )}

                {/* Rich Content Editor Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Article Content & In-Body Media</h3>
                      <p className="text-xs text-gray-500">Use formatting tools below to format text and embed images</p>
                    </div>
                  </div>

                  {/* Clean Light Formatting Toolbar */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 p-2 rounded-xl border border-gray-200">
                    <button
                      type="button"
                      onClick={() => applyFormat('bold')}
                      className="p-1.5 bg-white hover:bg-gray-200 border border-gray-200 text-gray-800 rounded text-xs font-bold transition shadow-2xs"
                      title="Bold Selected Text"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('italic')}
                      className="p-1.5 bg-white hover:bg-gray-200 border border-gray-200 text-gray-800 rounded text-xs transition shadow-2xs"
                      title="Italic Selected Text"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('underline')}
                      className="p-1.5 bg-white hover:bg-gray-200 border border-gray-200 text-gray-800 rounded text-xs transition shadow-2xs"
                      title="Underline Text"
                    >
                      <Underline className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('heading')}
                      className="p-1.5 bg-white hover:bg-gray-200 border border-gray-200 text-gray-800 rounded text-xs font-bold transition shadow-2xs"
                      title="Heading 2"
                    >
                      <Heading2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('quote')}
                      className="p-1.5 bg-white hover:bg-gray-200 border border-gray-200 text-gray-800 rounded text-xs transition shadow-2xs"
                      title="Blockquote"
                    >
                      <Quote className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('ussd')}
                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-mono font-bold flex items-center gap-1 transition shadow-2xs"
                      title="Insert USSD Code Badge (*920#)"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>*920#</span>
                    </button>

                    <span className="text-gray-300 px-1">|</span>

                    <button
                      type="button"
                      onClick={() => applyFormat('banner-image')}
                      className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-800 border border-gray-200 rounded text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                      title="Insert and crop a full-width story banner image"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-[#ffa200]" />
                      <span>Banner Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('wrap-image')}
                      className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-800 border border-gray-200 rounded text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                      title="Insert and crop an image that wraps text around it (Float Left)"
                    >
                      <Crop className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Wrap Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormat('video')}
                      className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-800 border border-gray-200 rounded text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                    >
                      <Film className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Video Embed</span>
                    </button>
                  </div>

                  <textarea
                    id="story-content-textarea"
                    rows={12}
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="Write your article paragraphs here... Use the toolbar above to add headings, quotes, banner images, or floating photos!"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-sans text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-[#ffa200] focus:ring-1 focus:ring-[#ffa200] leading-relaxed"
                  />

                  {/* Real-time Live Preview Card (Clean Editorial White Paper Style) */}
                  <div className="p-5 bg-white border border-gray-200 rounded-2xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-[#ffa200]" />
                        <span>Live Article Preview</span>
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        Real-Time Rendering
                      </span>
                    </div>

                    <div className="prose max-w-none text-xs text-gray-800 space-y-3">
                      {form.content ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: form.content
                              .replace(/## (.*)/g, '<h2 class="text-base font-bold text-gray-900 mt-4 mb-2 text-amber-600">$1</h2>')
                              .replace(/> "(.*)"/g, '<blockquote class="border-l-4 border-[#ffa200] bg-amber-50/50 p-3 italic text-gray-800 my-2 rounded-r-xl">$1</blockquote>')
                              .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                              .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
                              .replace(/`(\*[\d*#]+)`/g, '<span class="inline-block bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">$1</span>')
                              .replace(/!\[(.*?)\]\((.*?)\)/g, '<div class="my-3 rounded-xl overflow-hidden border border-gray-200"><img src="$2" alt="$1" class="w-full h-auto object-cover max-h-64" /></div>')
                              .replace(/\n\n/g, '<br /><br />')
                          }}
                        />
                      ) : (
                        <p className="text-gray-400 italic">
                          Your formatted preview will appear live here as you write...
                        </p>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN (30% SIDEBAR: BYLINE & PUBLISHING METADATA) */}
              <div className="space-y-6">
                
                {/* Author Byline Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <h3 className="text-sm font-bold text-gray-900">Author Byline</h3>
                    <button
                      type="button"
                      onClick={handleUseMyProfile}
                      className="text-[11px] text-[#d07b00] hover:underline font-bold flex items-center gap-1"
                    >
                      <User className="w-3 h-3" />
                      <span>Use My Profile</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Author Name *</label>
                      <input
                        type="text"
                        value={form.author}
                        onChange={(e) => setForm({ ...form, author: e.target.value })}
                        placeholder="e.g. Khatayon Buluse"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:bg-white focus:border-[#ffa200] font-semibold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Author Role</label>
                      <input
                        type="text"
                        value={form.authorRole}
                        onChange={(e) => setForm({ ...form, authorRole: e.target.value })}
                        placeholder="e.g. Master Beekeeper / Sourcing"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:bg-white focus:border-[#ffa200]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Estimated Read Time</label>
                      <input
                        type="text"
                        value={form.readTime}
                        onChange={(e) => setForm({ ...form, readTime: e.target.value })}
                        placeholder="e.g. 4 min read"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:bg-white focus:border-[#ffa200] font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Publishing Settings Card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 space-y-5 shadow-xs">
                  <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2.5">
                    Publish Settings & Placement
                  </h3>

                  {/* Status Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Publish Status</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                        form.status === 'Active'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-2xs'
                          : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}>
                        <input
                          type="radio"
                          name="storyStatus"
                          checked={form.status === 'Active'}
                          onChange={() => setForm({ ...form, status: 'Active' })}
                          className="hidden"
                        />
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs">Active (Live)</span>
                      </label>

                      <label className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                        form.status === 'Draft'
                          ? 'bg-orange-50 border-orange-300 text-orange-800 font-bold shadow-2xs'
                          : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}>
                        <input
                          type="radio"
                          name="storyStatus"
                          checked={form.status === 'Draft'}
                          onChange={() => setForm({ ...form, status: 'Draft' })}
                          className="hidden"
                        />
                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                        <span className="text-xs">Draft</span>
                      </label>
                    </div>
                  </div>

                  {/* Placement Checkboxes */}
                  <div className="space-y-3 pt-1 border-t border-gray-100">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.isFeatured}
                        onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                        className="mt-0.5 rounded accent-[#ffa200]"
                      />
                      <div>
                        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          <Bookmark className="w-3.5 h-3.5 text-[#ffa200]" />
                          <span>Hero Featured Story</span>
                        </span>
                        <span className="text-xs text-gray-500 block">
                          Pins as the large hero highlight on the website
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.isTopPick}
                        onChange={(e) => setForm({ ...form, isTopPick: e.target.checked })}
                        className="mt-0.5 rounded accent-[#ffa200]"
                      />
                      <div>
                        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-[#ffa200]" />
                          <span>Top Pick Grid</span>
                        </span>
                        <span className="text-xs text-gray-500 block">
                          Appears in the 3-column top stories grid
                        </span>
                      </div>
                    </label>

                    {form.type === 'news' && (
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={form.isBreaking}
                          onChange={(e) => setForm({ ...form, isBreaking: e.target.checked })}
                          className="mt-0.5 rounded accent-red-600"
                        />
                        <div>
                          <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-red-600 fill-current" />
                            <span>Breaking News Alert</span>
                          </span>
                          <span className="text-xs text-gray-500 block">
                            Displays urgent breaking news badge
                          </span>
                        </div>
                      </label>
                    )}
                  </div>

                  {/* Submit Actions */}
                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <button
                      type="button"
                      onClick={handleSaveStory}
                      disabled={saving}
                      className="w-full py-3 bg-[#ffa200] hover:bg-[#e69100] text-black font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-sm active:scale-98 disabled:opacity-50"
                    >
                      {saving ? 'Publishing to Website...' : (isEditing ? 'Save Changes' : 'Publish Story Live')}
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl border border-gray-200 transition"
                    >
                      Cancel & Return to Stories
                    </button>
                  </div>

                </div>

              </div>

            </div>

          </div>
        )}

        {/* =========================================================================
            IMAGE CROPPER & PRESET MODAL (LINK-BASED & CROPPING)
           ========================================================================= */}
        <ImageCropperModal
          isOpen={cropperModal.isOpen}
          initialImageUrl={cropperModal.imageUrl}
          title={cropperModal.title}
          subtitle={cropperModal.subtitle}
          onClose={() => setCropperModal(prev => ({ ...prev, isOpen: false }))}
          onApplyCrop={handleApplyCroppedImage}
        />

      </div>
    </AuthShield>
  );
}
