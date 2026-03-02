const { useState, useEffect, useMemo, useRef, useCallback } = React;

const LucideIcon = ({ name, className = '', style = {}, size, strokeWidth = 2 }) => {
    const ref = React.useRef(null);
    React.useEffect(() => {
        if (ref.current && window.lucide) {
            ref.current.innerHTML = '';
            const i = document.createElement('i');
            i.setAttribute('data-lucide', name);
            ref.current.appendChild(i);
            window.lucide.createIcons({
                root: ref.current,
                attrs: {
                    'stroke-width': strokeWidth,
                    width: size || '1em',
                    height: size || '1em'
                }
            });
        }
    }, [name, size, strokeWidth]);
    return <span ref={ref} className={`inline-flex items-center justify-center ${className}`} style={{ ...style, verticalAlign: 'middle', lineHeight: '1' }} />;
};

const TAG_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const getRandomColor = () => TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];

const UNSORTED_ALIASES = new Set(['', 'general', 'genel', 'unsorted', 'gelen kutusu']);
const normalizeFolder = (folder) => {
    const raw = folder == null ? '' : String(folder).trim();
    if (!raw) return null;
    return UNSORTED_ALIASES.has(raw.toLowerCase()) ? null : raw;
};
const isUnsortedFolder = (folder) => normalizeFolder(folder) === null;
const getFolderLabel = (folder) => normalizeFolder(folder) || 'Unsorted';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = new Date(Number(dateStr) || dateStr);
        if (!isNaN(d.getTime())) {
            return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        }
        const parts = dateStr.split(/[-/.]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) return `${parts[2].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[0]}`;
            if (dateStr.includes('/')) return `${parts[1].padStart(2, '0')}.${parts[0].padStart(2, '0')}.${parts[2]}`;
            return `${parts[0].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[2]}`;
        }
        return dateStr;
    } catch { return dateStr; }
};

const sanitizeUrl = (url) => {
    if (!url) return '#';
    const trimmed = url.trim();
    return trimmed.startsWith('http') ? trimmed : 'https://' + trimmed;
};

const extractTweetId = (url) => {
    if (!url || typeof url !== 'string') return null;
    if (url.includes('reddit.com')) {
        const match = url.match(/comments\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    }
    const match = url.match(/status\/(\d+)/);
    return match && /^\d+$/.test(match[1]) ? match[1] : null;
};

const extractHandle = (url) => {
    if (!url || typeof url !== 'string') return '@user';
    if (url.includes('reddit.com')) {
        const match = url.match(/r\/([a-zA-Z0-9_]+)/);
        return match ? `r/${match[1]}` : 'Reddit User';
    }
    const match = url.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/);
    return match ? `@${match[1]}` : '@user';
};

const getHighResUrl = (url) => {
    if (!url) return '';
    if (url.match(/\.(mp4|webm|ogg|m3u8)/i)) return url;
    if (url.includes('name=')) return url.replace(/name=[a-zA-Z0-9_]+/, 'name=orig');
    if (url.includes('pbs.twimg.com')) return url + (url.includes('?') ? '&' : '?') + 'name=orig';
    return url;
};

const handleDownload = async (url) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'bookmark_base_media';
        a.click();
    } catch (err) { window.open(url, '_blank'); }
};

const HlsVideoPlayer = ({ src, poster, className, controls, autoPlay, muted, ...rest }) => {
    const videoRef = useRef(null);
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;
        let hls;
        if (src.includes('.m3u8') && window.Hls && window.Hls.isSupported()) {
            hls = new window.Hls();
            hls.loadSource(src);
            hls.attachMedia(video);
            if (autoPlay) hls.on(window.Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => { }));
        } else { video.src = src; if (autoPlay) video.play().catch(() => { }); }
        return () => hls && hls.destroy();
    }, [src, autoPlay]);
    return <video ref={videoRef} className={className} controls={controls} muted={muted} poster={poster} playsInline preload="metadata" {...rest} />;
};

const TweetEmbed = ({ tweetId }) => {
    const containerRef = useRef(null);
    useEffect(() => {
        if (window.twttr && tweetId && containerRef.current) {
            containerRef.current.innerHTML = '';
            window.twttr.widgets.createTweet(tweetId, containerRef.current, { theme: 'light', align: 'center', dnt: true });
        }
    }, [tweetId]);
    return <div ref={containerRef} className="w-full min-h-[150px] flex items-center justify-center bg-slate-50 rounded-xl" />;
};

const RedditEmbed = React.memo(({ url }) => {
    let embedUrl = '';
    try {
        const path = new URL(url).pathname;
        embedUrl = `https://www.redditmedia.com${path}?ref_source=embed&ref=share&embed=true`;
    } catch (e) {
        embedUrl = url;
    }
    return (
        <div className="w-full bg-slate-50 flex justify-center rounded-xl overflow-hidden" style={{ minHeight: '300px' }}>
            <iframe
                src={embedUrl}
                sandbox="allow-scripts allow-same-origin allow-popups"
                style={{ border: 'none', width: '100%', height: '400px' }}
                scrolling="yes"
            />
        </div>
    );
});

const renderFormattedText = (text) => {
    if (!text) return '';
    const regex = /(\[[^\]]+\]\(https?:\/\/[^\s\)]+\)|https?:\/\/[^\s]+|#\w+|@\w+)/g;
    const lines = String(text).split('\n');
    return lines.map((line, i, arr) => {
        const parts = line.split(regex);
        const lineContent = parts.map((part, j) => {
            if (!part) return part;
            const mdMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)$/);
            if (mdMatch) {
                return <a key={j} href={mdMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all" onClick={(e) => e.stopPropagation()}>{mdMatch[1]}</a>;
            } else if (/^https?:\/\//.test(part)) {
                return <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all" onClick={(e) => e.stopPropagation()}>{part.replace(/^https?:\/\/(www\.)?/, '')}</a>;
            } else if (part.startsWith('#')) {
                return <a key={j} href={`https://x.com/hashtag/${part.substring(1)}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline" onClick={(e) => e.stopPropagation()}>{part}</a>;
            } else if (part.startsWith('@')) {
                return <a key={j} href={`https://x.com/${part.substring(1)}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline" onClick={(e) => e.stopPropagation()}>{part}</a>;
            }
            return part;
        });
        return <React.Fragment key={i}>{lineContent}{i !== arr.length - 1 && <br />}</React.Fragment>;
    });
};

const CustomTweetCard = React.memo(({ bookmark, onImageClick }) => {
    const handle = bookmark.authorHandle || extractHandle(bookmark.url);
    const name = bookmark.authorName || handle;
    const avatar = bookmark.profileImg || (bookmark.url && bookmark.url.includes('reddit.com') ? 'https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png' : 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png');
    const medias = bookmark.mediaUrls ? String(bookmark.mediaUrls).split(',').filter(Boolean) : [];
    const isVideo = bookmark.mediaType === 'video' || medias.some(m => String(m).match(/\.(mp4|webm|ogg|m3u8)/i));
    const isReddit = bookmark.url && bookmark.url.includes('reddit.com');

    return (
        <div className="text-left w-full">
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-3 overflow-hidden pr-2">
                    <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover border border-slate-100 shrink-0" />
                    <div className="flex flex-col overflow-hidden">
                        <span className="font-bold text-slate-900 text-[15px] leading-tight truncate">{name}</span>
                        <span className="text-slate-500 text-xs truncate">{handle}</span>
                    </div>
                </div>
            </div>
            <p className="text-slate-800 text-[17px] leading-relaxed whitespace-pre-wrap mb-3 px-1 break-words overflow-hidden">
                {renderFormattedText(bookmark.tweetText)}
            </p>
            {medias.length > 0 && (
                <div className={`rounded-2xl overflow-hidden border border-slate-100 bg-transparent ${medias.length > 1 && !isVideo ? 'grid grid-cols-2 gap-1 aspect-square md:aspect-video' : ''}`}>
                    {isVideo ? (
                        <a
                            href={getHighResUrl(medias[0])}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative w-full bg-black flex items-center justify-center aspect-video cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onImageClick(medias, 0, 'video', bookmark.posterUrl);
                            }}
                        >
                            <video src={medias[0]} className="w-full h-full object-cover opacity-70 pointer-events-none" muted playsInline />
                            <div className="absolute w-12 h-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center z-10 pointer-events-none">
                                <LucideIcon name="play" className="text-white text-xl ml-1" />
                            </div>
                        </a>
                    ) : (
                        medias.map((url, idx) => {
                            let itemClass = "w-full h-full object-cover cursor-pointer hover:opacity-95 bg-slate-100 transition-all active:scale-[0.98]";
                            let wrapperClass = "relative";
                            if (medias.length === 3 && idx === 0) wrapperClass = "row-span-2 h-full";
                            return (
                                <a
                                    key={idx}
                                    href={getHighResUrl(url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={wrapperClass}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onImageClick(medias, idx, 'image');
                                    }}
                                >
                                    <img src={url} alt="Media" className={`${itemClass} pointer-events-none`} />
                                </a>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
});

const CustomDropdown = ({ value, onChange, options, isMulti }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    let tags = [];
    let currentInput = value || '';
    if (isMulti) {
        const parts = (value || '').split(',');
        if (parts.length > 1) {
            tags = parts.slice(0, -1).map(t => t.trim()).filter(Boolean);
            currentInput = parts[parts.length - 1].trimStart();
        } else {
            tags = [];
            currentInput = value || '';
        }
    }

    const handleInputChange = (e) => {
        if (isMulti) {
            const newText = e.target.value;
            const prefix = tags.length > 0 ? tags.join(', ') + ', ' : '';
            onChange(prefix + newText);
        } else {
            onChange(e.target.value);
        }
        setIsOpen(true);
    };

    const handleRemoveTag = (e, tagToRemove) => {
        e.preventDefault();
        e.stopPropagation();
        const newTags = tags.filter(t => t !== tagToRemove);
        const prefix = newTags.length > 0 ? newTags.join(', ') + ', ' : '';
        onChange(prefix + currentInput);
    };

    const handleOptionSelect = (e, optValue) => {
        e.preventDefault();
        e.stopPropagation();
        if (isMulti) {
            const optTarget = optValue.toLowerCase();
            if (tags.includes(optTarget)) {
                const newTags = tags.filter(t => t !== optTarget);
                const prefix = newTags.length > 0 ? newTags.join(', ') + ', ' : '';
                onChange(prefix + currentInput);
            } else {
                const newTags = [...tags, optTarget];
                onChange(newTags.join(', ') + ', ');
            }
        } else {
            onChange(optValue);
            setIsOpen(false);
        }
    };

    const isOptionSelected = (optValue) => {
        if (!value) return false;
        if (!isMulti) return value.toLowerCase().trim() === optValue.toLowerCase().trim();
        return tags.includes(optValue.toLowerCase());
    };

    const searchVal = isMulti
        ? currentInput.trim().toLowerCase()
        : (value || '').trim().toLowerCase();

    // If it's a single select and the exact value is already selected, don't filter out the other options
    const exactMatch = !isMulti ? options.some(opt => opt.name.toLowerCase() === searchVal) : false;
    const filteredOptions = exactMatch ? options : options.filter(opt => opt.name.toLowerCase().includes(searchVal));

    const allOptions = options.map(opt => ({ ...opt }));

    return (
        <div className={`tm-input-wrapper ${isOpen ? 'open' : ''}`} ref={wrapperRef}>
            <div
                className={`w-full p-1.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus-within:ring-1 focus-within:ring-black transition-all flex items-center min-h-[46px] ${isMulti ? 'flex-wrap gap-1.5' : ''}`}
                onClick={() => setIsOpen(true)}
            >
                {isMulti && tags.map((tag, idx) => {
                    const tagObj = options.find(o => o.name === tag);
                    const bgColor = tagObj ? tagObj.color : '#cbd5e1';
                    return (
                        <span key={`${tag}-${idx}`} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 shadow-sm rounded-lg text-[13px] font-bold text-slate-700">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: bgColor }}></span>
                            {tag}
                            <button onClick={(e) => handleRemoveTag(e, tag)} className="ml-0.5 text-slate-400 hover:text-red-500 font-bold focus:outline-none">
                                <LucideIcon name="x" className="text-[11px]" />
                            </button>
                        </span>
                    );
                })}
                <input
                    type="text"
                    value={isMulti ? currentInput : value}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    placeholder={isMulti ? (tags.length === 0 ? "Etiket ara veya virgülle ayır..." : "") : "Klasör ara veya seç..."}
                    className="flex-1 min-w-[120px] bg-transparent outline-none py-1 px-2"
                />
            </div>
            <div className="tm-dropdown-arrow mr-2">
                <LucideIcon name="chevron-down" className="text-xs" />
            </div>
            <div className={`tm-dropdown-menu custom-scrollbar ${isOpen ? 'show' : ''}`}>
                {(isOpen ? filteredOptions : allOptions).length > 0 ? (isOpen ? filteredOptions : allOptions).map(opt => {
                    const selected = isOptionSelected(opt.name);
                    return (
                        <div
                            key={opt.id || opt.name}
                            className={`tm-dropdown-item ${selected ? 'selected' : ''}`}
                            onClick={(e) => handleOptionSelect(e, opt.name)}
                        >
                            <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color || '#cbd5e1' }}></span>
                                {isMulti ? `#${opt.name}` : opt.name}
                            </span>
                            <div className="tm-dropdown-checkbox"></div>
                        </div>
                    );
                }) : (
                    <div className="tm-dropdown-item" style={{ color: '#94a3b8', justifyContent: 'center' }}>Sonuç bulunamadı</div>
                )}
            </div>
        </div>
    );
};

/* Dexie Configuration */
const db = new window.Dexie('TweetmarkDB');
db.version(1).stores({
    bookmarks: 'id',
    folders: 'id',
    tags: 'id',
    trash: 'id'
});

/* Firebase Configuration */
const firebaseConfig = {
    apiKey: "AIzaSyDustCH0f1DYc8kkFG3qLMRrIooVp7s8Sw",
    authDomain: "bookmark-base.firebaseapp.com",
    projectId: "bookmark-base",
    storageBucket: "bookmark-base.firebasestorage.app",
    messagingSenderId: "760543001497",
    appId: "1:760543001497:web:e1914fb0ef9b03b52d7108"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const fdb = firebase.firestore();


function App() {
    const [bookmarks, setBookmarks] = useState([]);
    const [customFolders, setCustomFolders] = useState([]);
    const [customTags, setCustomTags] = useState([]);
    const [trash, setTrash] = useState([]);
    const [user, setUser] = useState(null);
    const [isDbLoaded, setIsDbLoaded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [initialFocusedTweet, setInitialFocusedTweet] = useState(null);
    const [activeAddMenu, setActiveAddMenu] = useState(null);

    const [activeFilters, setActiveFilters] = useState(['All']);

    const toggleFilter = (filter, isMulti = false) => {
        setActiveFilters(prev => {
            if (filter === 'Trash') return ['Trash'];
            if (filter === 'All') return ['All'];
            if (filter === 'AllTags') return ['AllTags'];

            if (!isMulti) return [filter];

            let next = prev.filter(f => f !== 'Trash' && f !== 'All' && f !== 'AllTags');
            if (next.includes(filter)) {
                next = next.filter(f => f !== filter);
            } else {
                next.push(filter);
            }
            return next.length === 0 ? ['All'] : next;
        });
    };
    const [searchQuery, setSearchQuery] = useState('');
    const [gridCols, setGridCols] = useState(() => parseInt(localStorage.getItem('tweetGridCols')) || 3);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);
    const [focusedTweet, setFocusedTweet] = useState(null);
    const [previewState, setPreviewState] = useState(null);
    const [expandedFolders, setExpandedFolders] = useState([]);
    const [storageInfo, setStorageInfo] = useState({ used: 0, quota: 0 });

    useEffect(() => {
        // Calculate the exact payload size to reflect true archive size and cloud capacity
        try {
            const dataToMeasure = { bookmarks, customFolders, customTags, trash };
            const jsonString = JSON.stringify(dataToMeasure);
            const byteSize = new Blob([jsonString]).size;

            setStorageInfo({
                used: byteSize,
                quota: 100 * 1024 * 1024 // Fixed 100MB Quota
            });
        } catch (err) {
            console.error("Failed to calculate archive size:", err);
        }
    }, [bookmarks, customFolders, customTags, trash]);

    // Handle Auth Changes
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(u => {
            setUser(u);
            // We don't call loadFromFirestore here directly anymore.
            // It is handled by the initial loadDb effect or a dedicated auth+db effect.
        });
        return () => unsubscribe();
    }, []);

    // Track the last UID we loaded to handle user switching correctly
    const lastLoadedUid = useRef(null);
    const isCloudUpdateActive = useRef(false);
    const saveQueueRef = useRef(Promise.resolve());
    const prevSyncStateRef = useRef(null);

    // Effect to trigger loadFromFirestore ONLY when both user and DB are ready for the first time or when user changes
    useEffect(() => {
        if (user && isDbLoaded && lastLoadedUid.current !== user.uid) {
            lastLoadedUid.current = user.uid;
            loadFromFirestore(user.uid);
        } else if (!user) {
            lastLoadedUid.current = null;
        }
    }, [user, isDbLoaded]);

    const handleLogin = async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            await auth.signInWithPopup(provider);
            showToast("Logged in successfully!", "success");
        } catch (error) {
            console.error("Login Error:", error);
            showToast("Login failed. Check browser popup settings.", "error");
        }
    };

    const handleLogout = () => {
        auth.signOut();
        showToast("Logged out.", "info");
    };


    const isItemEqual = (a, b) => {
        if (a === b) return true;
        if (!a || !b) return false;
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        for (let key of keysA) {
            if (a[key] !== b[key]) {
                if (Array.isArray(a[key]) && Array.isArray(b[key])) {
                    if (a[key].length !== b[key].length) return false;
                    for (let i = 0; i < a[key].length; i++) {
                        if (a[key][i] !== b[key][i]) return false;
                    }
                } else {
                    return false;
                }
            }
        }
        return true;
    };

    const loadFromFirestore = async (uid) => {
        if (!isDbLoaded) return;
        setIsSyncing(true);
        try {
            const metaDoc = await fdb.collection('users').doc(uid).collection('meta').doc('state').get();
            let cloudTime = 0;
            let isMigrated = false;
            let forceMigration = false;
            let oldData = null;

            if (metaDoc.exists) {
                const mData = metaDoc.data();
                cloudTime = typeof mData.lastUpdated === 'number' ? mData.lastUpdated : (mData.lastUpdated?.toMillis?.() || 0);
                isMigrated = mData.schemaVersion >= 2;
            } else {
                // Determine if we need migration from old doc
                const oldDoc = await fdb.collection('users').doc(uid).get();
                if (oldDoc.exists) {
                    oldData = oldDoc.data();
                    cloudTime = typeof oldData.lastUpdated === 'number' ? oldData.lastUpdated : (oldData.lastUpdated?.toMillis?.() || 0);
                    forceMigration = true;
                }
            }

            const localTime = parseInt(localStorage.getItem('tweetLastLocalUpdate')) || 0;

            if (forceMigration || cloudTime > localTime + 2000 || (bookmarks.length === 0 && customFolders.length === 0 && customTags.length === 0)) {
                isCloudUpdateActive.current = true;

                let data = { bookmarks: [], folders: [], tags: [], trash: [] };

                if (forceMigration) {
                    // Execute forced migration inline with deterministic state
                    showToast("Upgrading data sync. Do not close...", "info");

                    data.bookmarks = oldData.bookmarks || [];
                    data.folders = oldData.folders || [];
                    data.tags = oldData.tags || [];
                    data.trash = oldData.trash || [];

                    prevSyncStateRef.current = null;
                    await saveToFirestore(uid, true, data);
                    showToast("Upgraded to new Cloud Sync Architecture.", "success");
                } else if (isMigrated) {
                    const [bSnap, fSnap, tSnap, trSnap] = await Promise.all([
                        fdb.collection('users').doc(uid).collection('bookmarks').get(),
                        fdb.collection('users').doc(uid).collection('folders').get(),
                        fdb.collection('users').doc(uid).collection('tags').get(),
                        fdb.collection('users').doc(uid).collection('trash').get()
                    ]);

                    data.bookmarks = bSnap.empty ? [] : bSnap.docs.map(d => d.data());
                    data.folders = fSnap.empty ? [] : fSnap.docs.map(d => d.data());
                    data.tags = tSnap.empty ? [] : tSnap.docs.map(d => d.data());
                    data.trash = trSnap.empty ? [] : trSnap.docs.map(d => d.data());
                }

                setBookmarks(data.bookmarks);
                setCustomFolders(data.folders);
                setCustomTags(data.tags);
                setTrash(data.trash);

                prevSyncStateRef.current = data;
                localStorage.setItem('tweetLastLocalUpdate', cloudTime.toString());

                showToast("Cloud sync complete!", "success");

                // Deterministic guard reset using requestAnimationFrame to ensure React has fully rendered the state
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        isCloudUpdateActive.current = false;
                    });
                });

            } else if (localTime > cloudTime + 2000) {
                // Local is newer or untouched after cloud missing, push everything
                prevSyncStateRef.current = null;
                await saveToFirestore(uid, true);
            } else {
                // Safe and strictly in sync
                prevSyncStateRef.current = { bookmarks, folders: customFolders, tags: customTags, trash };
            }
        } catch (err) {
            console.error("Cloud Load Error:", err);
            showToast("Cloud load failed. Please check your connection.", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const saveToFirestore = async (uid, force = false, explicitData = null) => {
        if (!uid || !isDbLoaded) return;

        const currentBookmarks = explicitData ? explicitData.bookmarks : bookmarks;
        const currentFolders = explicitData ? explicitData.folders : customFolders;
        const currentTags = explicitData ? explicitData.tags : customTags;
        const currentTrash = explicitData ? explicitData.trash : trash;

        const prevState = prevSyncStateRef.current;
        const hasAnyData = currentBookmarks.length > 0 || currentFolders.length > 0 || currentTags.length > 0 || currentTrash.length > 0;
        const hadAnyData = prevState && (prevState.bookmarks?.length > 0 || prevState.folders?.length > 0 || prevState.tags?.length > 0 || prevState.trash?.length > 0);

        if (!force && !hasAnyData && !hadAnyData) return;

        const saveTask = async () => {
            try {
                const prevState = prevSyncStateRef.current;

                let batch = fdb.batch();
                let opsCount = 0;
                const commitBatch = async () => {
                    if (opsCount > 0) {
                        try {
                            await batch.commit();
                        } catch (commitErr) {
                            console.error('Batch commit failed:', commitErr);
                            throw commitErr; // Critical fix: throw on partial batch fail
                        }
                        batch = fdb.batch();
                        opsCount = 0;
                    }
                };

                const applyDiff = async (collectionName, currentItems, prevItems) => {
                    if (!prevItems) {
                        for (const item of currentItems) {
                            const itemId = item.id || item.name;
                            if (itemId == null) continue; // Skip items without valid IDs
                            const id = String(itemId);
                            const ref = fdb.collection('users').doc(uid).collection(collectionName).doc(id);
                            batch.set(ref, item);
                            opsCount++;
                            if (opsCount >= 490) await commitBatch();
                        }
                        return;
                    }

                    const prevMap = new Map((prevItems || []).map(i => [String(i.id || i.name), i]));
                    const currMap = new Map((currentItems || []).map(i => [String(i.id || i.name), i]));

                    for (const [id, item] of currMap.entries()) {
                        if (id === "undefined" || id === "null") continue;
                        const prevItem = prevMap.get(id);
                        // Shallow check is much faster than JSON.stringify, O(n * props)
                        if (!prevItem || !isItemEqual(prevItem, item)) {
                            const ref = fdb.collection('users').doc(uid).collection(collectionName).doc(id);
                            batch.set(ref, item);
                            opsCount++;
                            if (opsCount >= 490) await commitBatch();
                        }
                    }

                    for (const id of prevMap.keys()) {
                        if (!currMap.has(id)) {
                            const ref = fdb.collection('users').doc(uid).collection(collectionName).doc(id);
                            batch.delete(ref);
                            opsCount++;
                            if (opsCount >= 490) await commitBatch();
                        }
                    }
                };

                await applyDiff('bookmarks', currentBookmarks, prevState?.bookmarks);
                await applyDiff('folders', currentFolders, prevState?.folders);
                await applyDiff('tags', currentTags, prevState?.tags);
                await applyDiff('trash', currentTrash, prevState?.trash);

                await commitBatch();

                await fdb.collection('users').doc(uid).collection('meta').doc('state').set({
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    schemaVersion: 2
                });

                // Clear old root document fields selectively to clean up payload without breaking collections or rules
                if (force && !prevState) {
                    try {
                        const rootDoc = await fdb.collection('users').doc(uid).get();
                        if (rootDoc.exists && rootDoc.data().bookmarks) {
                            await fdb.collection('users').doc(uid).update({
                                bookmarks: firebase.firestore.FieldValue.delete(),
                                folders: firebase.firestore.FieldValue.delete(),
                                tags: firebase.firestore.FieldValue.delete(),
                                trash: firebase.firestore.FieldValue.delete()
                            });
                        }
                    } catch (e) { console.warn("Failed to clean up old root doc fields.", e); }
                }

                localStorage.setItem('tweetLastLocalUpdate', Date.now().toString());
                prevSyncStateRef.current = { bookmarks: currentBookmarks, folders: currentFolders, tags: currentTags, trash: currentTrash };
            } catch (err) {
                console.error('Cloud Sync Error:', err);
                if (force) showToast('Failed to save to cloud. Will retry later.', 'error');
                throw err;
            }
        };

        const executeTask = saveQueueRef.current.then(saveTask);
        saveQueueRef.current = executeTask.catch(e => {
            console.error("Queue boundary recovered from error", e);
        });

        return executeTask;
    };

    const [dragOverFolderId, setDragOverFolderId] = useState(null);
    const dragItemRef = useRef(null);

    // Debounce Search 
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    // Infinite Scroll
    const [visibleCount, setVisibleCount] = useState(20);
    const observerTarget = useRef(null);

    // Callbacks
    const handleImageClick = React.useCallback((medias, idx, type, poster) => {
        setPreviewState({ medias, currentIndex: idx, mediaType: type, poster });
    }, []);

    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null);
    const [folderNameInput, setFolderNameInput] = useState('');
    const [folderColorInput, setFolderColorInput] = useState('#3b82f6');

    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [editingTag, setEditingTag] = useState(null);
    const [tagNameInput, setTagNameInput] = useState('');
    const [tagColorInput, setTagColorInput] = useState('#64748b');
    const [isTagsExpanded, setIsTagsExpanded] = useState(true);

    const [isNoteEditing, setIsNoteEditing] = useState(false);

    const [newUrl, setNewUrl] = useState('');
    const [newFolder, setNewFolder] = useState('');
    const [newTags, setNewTags] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isEditingColors, setIsEditingColors] = useState(false);
    const [colorEditingIndex, setColorEditingIndex] = useState(null);
    const [accentColor, setAccentColor] = useState(() => localStorage.getItem('tweetAccentColor') || '#000000');

    const [customAccentColors, setCustomAccentColors] = useState(() => {
        const saved = localStorage.getItem('customAccentColors');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].id && parsed[0].color) return parsed;
            } catch (e) { }
        }
        return [
            { id: 1, color: '#000000' },
            { id: 2, color: '#3b82f6' },
            { id: 3, color: '#10b981' },
            { id: 4, color: '#f59e0b' },
            { id: 5, color: '#ef4444' },
            { id: 6, color: '#8b5cf6' },
            { id: 7, color: '#ec4899' },
            { id: 8, color: '#64748b' }
        ];
    });
    const [theme, setTheme] = useState(() => localStorage.getItem('tweetTheme') || 'light');

    useEffect(() => {
        localStorage.setItem('customAccentColors', JSON.stringify(customAccentColors));
    }, [customAccentColors]);
    const [autoBackup, setAutoBackup] = useState(() => localStorage.getItem('tweetAutoBackup') === 'true');
    const [lastBackup, setLastBackup] = useState(() => parseInt(localStorage.getItem('tweetLastBackup')) || 0);
    const [showBrandLines, setShowBrandLines] = useState(() => localStorage.getItem('tweetShowBrandLines') !== 'false');
    const [brandLineStyle, setBrandLineStyle] = useState(() => localStorage.getItem('tweetBrandLineStyle') || 'bar');

    useEffect(() => {
        localStorage.setItem('tweetShowBrandLines', showBrandLines);
    }, [showBrandLines]);

    useEffect(() => {
        localStorage.setItem('tweetBrandLineStyle', brandLineStyle);
    }, [brandLineStyle]);

    useEffect(() => {
        localStorage.setItem('tweetTheme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('tweetAutoBackup', autoBackup);
    }, [autoBackup]);

    // Auto backup logic
    useEffect(() => {
        if (!autoBackup || !isDbLoaded) return;

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        if (now - lastBackup > oneDay) {
            // Delay auto-backup slightly after load to not interfere with startup
            const timer = setTimeout(() => {
                handleExportJSON(true); // true means silent/auto mode
                const timestamp = Date.now();
                setLastBackup(timestamp);
                localStorage.setItem('tweetLastBackup', timestamp);
                showToast('Automatic backup completed', 'success');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [autoBackup, isDbLoaded, bookmarks.length]);

    // Toast notifications
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);
    const showToast = useCallback((message, type = 'info', undoAction = null, duration = 4000) => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, message, type, undoAction }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
        return id;
    }, []);
    const dismissToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

    // --- EFFECTS ---
    useEffect(() => {
        const loadDb = async () => {
            try {
                const bCount = await db.bookmarks.count();
                const fCount = await db.folders.count();
                const tCount = await db.tags.count();

                if (bCount === 0 && fCount === 0 && tCount === 0) {
                    // Migrate from localStorage
                    const safeParse = (key) => { try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : []; } catch (e) { return []; } };
                    const oldB = safeParse('tweetBookmarks_v1');
                    const oldF = safeParse('tweetFolders_v2');
                    const oldT = safeParse('tweetTags_v1');
                    const oldTr = safeParse('tweetTrash_v1');

                    setBookmarks(oldB);
                    setCustomFolders(oldF);
                    setCustomTags(oldT);
                    setTrash(oldTr);
                } else {
                    const b = await db.bookmarks.toArray();
                    const f = await db.folders.toArray();
                    const t = await db.tags.toArray();
                    const tr = await db.trash.toArray();
                    setBookmarks(b);
                    setCustomFolders(f);
                    setCustomTags(t);
                    setTrash(tr);
                }
            } catch (err) {
                console.error("Dexie Load Error", err);
            } finally {
                setIsDbLoaded(true);
            }
        };
        loadDb();
    }, []);

    useEffect(() => {
        const handleExternalMessage = (request, sender, sendResponse) => {
            const dynamicExtId = localStorage.getItem('bookmark_extension_id');
            const ALLOWED_EXTENSION_IDS = dynamicExtId ? [dynamicExtId] : [];
            if (!sender.id || !ALLOWED_EXTENSION_IDS.includes(sender.id)) {
                console.warn('Unauthorized external message from:', sender.id);
                return;
            }
            if (request.type === 'GET_APP_DATA') {
                sendResponse({
                    folders: customFolders,
                    tags: customTags
                });
            }
            return true;
        };

        if (window.chrome && chrome.runtime && chrome.runtime.onMessageExternal) {
            chrome.runtime.onMessageExternal.addListener(handleExternalMessage);
        }

        return () => {
            if (window.chrome && chrome.runtime && chrome.runtime.onMessageExternal) {
                chrome.runtime.onMessageExternal.removeListener(handleExternalMessage);
            }
        };
    }, [customFolders, customTags]);

    // --- EXTENSION SYNC EFFECT ---
    useEffect(() => {
        const checkPendingSync = () => {
            if (!isDbLoaded) return;
            try {
                // YENİ KAYITLAR İÇİN
                const pendingStr = localStorage.getItem('pending_twitter_sync');
                if (pendingStr) {
                    const pendingBookmarks = JSON.parse(pendingStr);
                    if (pendingBookmarks && pendingBookmarks.length > 0) {
                        setBookmarks(prev => {
                            const existingTweetIds = new Set(prev.map(b => b.tweetId));
                            const uniquePending = pendingBookmarks
                                .filter(b => !existingTweetIds.has(String(b.tweetId)))
                                .map(b => ({ ...b, folder: normalizeFolder(b.folder) }));
                            return uniquePending.length > 0 ? [...uniquePending, ...prev] : prev;
                        });
                        localStorage.removeItem('pending_twitter_sync');
                    }
                }

                // GÜNCELLEMELER İÇİN (Eklenti popup'ından gelen klasör/not/tag vb.)
                const pendingUpdatesStr = localStorage.getItem('pending_twitter_updates');
                if (pendingUpdatesStr) {
                    const updates = JSON.parse(pendingUpdatesStr);
                    if (updates && updates.length > 0) {
                        setBookmarks(prev => {
                            let newPrev = [...prev];
                            updates.forEach(upd => {
                                const idx = newPrev.findIndex(b => b.tweetId === String(upd.tweetId));
                                if (idx !== -1) {
                                    newPrev[idx] = { ...newPrev[idx], folder: normalizeFolder(upd.folder), tags: upd.tags, description: upd.note };
                                }
                            });
                            return newPrev;
                        });

                        const tagsFromUpdates = updates.flatMap(u => (u.tags || []));
                        if (tagsFromUpdates.length > 0) {
                            setCustomTags(prevTags => {
                                const newTagsList = [...prevTags];
                                let tagsChanged = false;
                                tagsFromUpdates.forEach(tag => {
                                    if (tag && !newTagsList.some(t => t.name === tag)) {
                                        newTagsList.push({ id: 't_' + Math.random().toString(36).substr(2, 9), name: tag, color: getRandomColor() });
                                        tagsChanged = true;
                                    }
                                });
                                return tagsChanged ? newTagsList : prevTags;
                            });
                        }
                        localStorage.removeItem('pending_twitter_updates');
                    }
                }
            } catch (err) { console.error("Sync error:", err); }
        };

        checkPendingSync();
        window.addEventListener('twitter-bookmarks-synced', checkPendingSync);
        return () => window.removeEventListener('twitter-bookmarks-synced', checkPendingSync);
    }, [isDbLoaded]);

    useEffect(() => {
        if (!isDbLoaded) return;
        const handler = setTimeout(() => {
            const syncDB = async () => {
                try {
                    await db.transaction('rw', db.bookmarks, db.folders, db.tags, db.trash, async () => {
                        const doIncrementalSync = async (table, items) => {
                            const existingIds = new Set(await table.toCollection().primaryKeys());
                            const currentIds = new Set(items.map(item => item.id));

                            const toDelete = [...existingIds].filter(id => !currentIds.has(id));
                            if (toDelete.length) await table.bulkDelete(toDelete);
                            if (items.length) await table.bulkPut(items);
                        };

                        await doIncrementalSync(db.bookmarks, bookmarks);
                        await doIncrementalSync(db.folders, customFolders);
                        await doIncrementalSync(db.tags, customTags);
                        await doIncrementalSync(db.trash, trash);
                    });

                    // Offline sync logic
                    // Only push to cloud if this wasn't triggered BY a cloud load
                    if (user && isDbLoaded && !isCloudUpdateActive.current) {
                        // Enqueue the offline sync
                        saveToFirestore(user.uid);
                    }

                    window.dispatchEvent(new CustomEvent('tweetmark-data-changed'));
                } catch (err) { console.error("Dexie sync error:", err); }
            };
            syncDB();
        }, 3000); // 3 sn debounce - Reduced write amplification

        return () => clearTimeout(handler);
    }, [bookmarks, customFolders, customTags, trash, isDbLoaded, user]);

    useEffect(() => {
        localStorage.setItem('tweetGridCols', gridCols.toString());
        localStorage.setItem('tweetAccentColor', accentColor);
    }, [gridCols, accentColor]);

    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedSearchQuery(searchQuery); }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    useEffect(() => {
        setVisibleCount(20);
    }, [activeFilters, debouncedSearchQuery, gridCols]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => { if (entries[0].isIntersecting) setVisibleCount(prev => prev + 20); },
            { threshold: 0.1 }
        );
        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!window.twttr) {
            const script = document.createElement("script");
            script.src = "https://platform.twitter.com/widgets.js";
            script.async = true;
            document.body.appendChild(script);
        }
    }, []);

    // Preload all images when preview opens
    useEffect(() => {
        if (previewState && previewState.medias && previewState.mediaType !== 'video') {
            previewState.medias.forEach(url => {
                const img = new Image();
                img.src = getHighResUrl(url);
            });
        }
    }, [previewState?.medias]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.dropdown-container')) {
                setActiveAddMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- HANDLERS ---
    const handleExportJSON = (isAuto = false) => {
        try {
            const payload = {
                bookmarks,
                customFolders,
                customTags,
                trash,
                exportDate: new Date().toISOString(),
                version: '2.0'
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toLocaleDateString().replace(/\//g, '-');
            a.download = isAuto ? `bookmark_base_auto_backup_${dateStr}.json` : `bookmark_base_manual_backup_${dateStr}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (err) {
            console.error("Backup failed:", err);
            showToast('Backup failed. Check console for details.', 'error');
        }
    };

    const handleImportJSON = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Prevent importing if it exceeds 100MB Limit
        if (file.size + storageInfo.used >= 100 * 1024 * 1024) {
            showToast('Archive Limit (100 MB) reached. Please delete some items first.', 'error');
            event.target.value = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                let valid = true;

                // Minimal structure validation
                if (data.bookmarks && !Array.isArray(data.bookmarks)) valid = false;
                if (data.customFolders && !Array.isArray(data.customFolders)) valid = false;
                if (data.customTags && !Array.isArray(data.customTags)) valid = false;
                if (data.trash && !Array.isArray(data.trash)) valid = false;

                // Validate individual bookmark objects minimally (e.g. they should have 'id' and 'tweetId')
                if (data.bookmarks && valid) {
                    const hasInvalidBookmark = data.bookmarks.some(b => typeof b !== 'object' || !b.id || !b.tweetId);
                    if (hasInvalidBookmark) valid = false;
                }

                if (!valid) {
                    showToast('Invalid or corrupted JSON file. Operation cancelled.', 'error');
                    return;
                }

                if (data.bookmarks && Array.isArray(data.bookmarks)) setBookmarks(data.bookmarks);
                if (data.customFolders && Array.isArray(data.customFolders)) setCustomFolders(data.customFolders);
                if (data.customTags && Array.isArray(data.customTags)) setCustomTags(data.customTags);
                if (data.trash && Array.isArray(data.trash)) setTrash(data.trash);

                showToast('Backup loaded successfully!', 'success');
            } catch (err) {
                showToast('JSON parse error! Make sure the file is not corrupted.', 'error');
                console.error("Import JSON Error:", err);
            }
        };
        reader.readAsText(file);
    };

    const handleAddBookmark = (e) => {
        e.preventDefault();

        // 100 MB Safety Limit
        if (storageInfo.used >= 100 * 1024 * 1024) {
            return showToast('Archive Limit Reached (100 MB). Please delete items to free up space.', 'error');
        }

        const tweetId = extractTweetId(newUrl);
        if (!tweetId) return showToast('Please enter a valid Twitter or Reddit link.', 'error');

        const tagsArray = newTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        const newTagsList = [...customTags];
        let tagsChanged = false;
        tagsArray.forEach(tag => {
            if (!newTagsList.some(t => t.name === tag)) {
                newTagsList.push({ id: 't_' + Math.random().toString(36).substr(2, 9), name: tag, color: getRandomColor() });
                tagsChanged = true;
            }
        });
        if (tagsChanged) setCustomTags(newTagsList);

        const now = new Date();
        const dateStr = now.toLocaleDateString('tr-TR');
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        const newBtn = {
            id: Date.now().toString(),
            tweetId,
            url: sanitizeUrl(newUrl),
            folder: normalizeFolder(newFolder),
            tags: tagsArray,
            description: newDesc.trim(),
            date: `${dateStr} ${timeStr}`,
            timestamp: now.getTime()
        };

        setBookmarks([newBtn, ...bookmarks]);
        setIsModalOpen(false);
        setNewUrl(''); setNewFolder(''); setNewTags(''); setNewDesc('');
    };

    const handleMoveToTrash = (e, id) => {
        if (e) e.stopPropagation();
        const item = bookmarks.find(b => b.id === id);
        if (item) {
            setTrash(prev => [{ ...item, deletedAt: Date.now() }, ...prev]);
            setBookmarks(prev => prev.filter(b => b.id !== id));
            if (focusedTweet && focusedTweet.id === id) setFocusedTweet(null);
            showToast('Moved to trash', 'info', () => {
                // Undo: restore the item
                setTrash(prev => prev.filter(t => t.id !== id));
                setBookmarks(prev => [item, ...prev]);
            });
        }
    };

    const handleRestoreFromTrash = (e, id) => {
        e.stopPropagation();
        const item = trash.find(t => t.id === id);
        if (item) {
            const { deletedAt, ...rest } = item;
            setBookmarks(prev => [rest, ...prev]);
            setTrash(prev => prev.filter(t => t.id !== id));
        }
    };

    const handlePermanentDelete = (e, id) => {
        e.stopPropagation();
        const item = trash.find(t => t.id === id);
        setTrash(prev => prev.filter(t => t.id !== id));
        showToast('Permanently deleted', 'info', () => {
            if (item) setTrash(prev => [item, ...prev]);
        });
    };

    const handleClearTrash = () => {
        if (trash.length === 0) return;
        const oldTrash = [...trash];
        setTrash([]);
        showToast(`${oldTrash.length} item(s) permanently deleted`, 'info', () => {
            setTrash(oldTrash);
        });
    };

    // Auto-cleanup: remove trash items older than 30 days
    useEffect(() => {
        if (trash.length === 0) return;
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const expired = trash.filter(t => t.deletedAt && t.deletedAt < thirtyDaysAgo);
        if (expired.length > 0) {
            setTrash(prev => prev.filter(t => !t.deletedAt || t.deletedAt >= thirtyDaysAgo));
            console.log(`Auto-cleaned ${expired.length} expired trash item(s)`);
        }
    }, [trash.length]);

    const handleSaveFolder = (e) => {
        e.preventDefault();
        const name = folderNameInput.trim();
        if (!name) return;
        if (!editingFolder && customFolders.some(f => f.name.toLowerCase() === name.toLowerCase())) {
            showToast('Folder already exists!', 'error');
            return;
        }
        if (editingFolder) {
            setCustomFolders(customFolders.map(f => f.id === editingFolder.id ? { ...f, name, color: folderColorInput } : f));
            setBookmarks(bookmarks.map(b => b.folder === editingFolder.name ? { ...b, folder: name } : b));
        } else {
            setCustomFolders([...customFolders, { id: 'f_' + Date.now(), name, color: folderColorInput, parentId: null, isPinned: false }]);
        }
        setIsFolderModalOpen(false);
        setEditingFolder(null);
    };

    const handleSaveTag = (e) => {
        e.preventDefault();
        const name = tagNameInput.trim().toLowerCase();
        if (!name) return;
        if (!editingTag && customTags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
            showToast('Tag already exists!', 'error');
            return;
        }
        if (editingTag) {
            setCustomTags(customTags.map(t => t.id === editingTag.id ? { ...t, name, color: tagColorInput } : t));
            setBookmarks(bookmarks.map(b => ({
                ...b,
                tags: (b.tags || []).map(tag => tag === editingTag.name ? name : tag)
            })));
        } else {
            setCustomTags([...customTags, { id: 't_' + Date.now(), name: name, color: tagColorInput }]);
        }
        setIsTagModalOpen(false);
        setEditingTag(null);
    };



    // --- RENDER HELPERS ---
    const getFolderAndDescendants = useCallback((folderId, list) => {
        const folder = list.find(f => f.id === folderId);
        if (!folder) return [];
        let names = [folder.name];
        list.filter(f => f.parentId === folderId).forEach(c => {
            names = names.concat(getFolderAndDescendants(c.id, list));
        });
        return names.filter(Boolean);
    }, []);

    const topLevelFolders = useMemo(() => customFolders.filter(f => !f.parentId), [customFolders]);

    const folderCounts = useMemo(() => {
        const directCounts = {};
        bookmarks.forEach(b => {
            const fName = normalizeFolder(b.folder) || 'Unsorted';
            directCounts[fName] = (directCounts[fName] || 0) + 1;
        });

        const childrenMap = {};
        const folderById = {};
        customFolders.forEach(f => {
            folderById[f.id] = f;
            childrenMap[f.id] = [];
        });

        customFolders.forEach(f => {
            if (f.parentId && childrenMap[f.parentId]) {
                childrenMap[f.parentId].push(f.id);
            }
        });

        const counts = {};
        const getCount = (fId) => {
            if (counts[fId] !== undefined) return counts[fId];
            const folder = folderById[fId];
            if (!folder) return 0;
            let total = directCounts[folder.name] || 0;
            if (childrenMap[fId]) {
                childrenMap[fId].forEach(childId => {
                    total += getCount(childId);
                });
            }
            counts[fId] = total;
            return total;
        };

        customFolders.forEach(f => {
            counts[f.id] = getCount(f.id);
        });
        return counts;
    }, [bookmarks, customFolders]);

    const tagCounts = useMemo(() => {
        const ObjectCounts = {};
        bookmarks.forEach(b => {
            (b.tags || []).forEach(t => {
                ObjectCounts[t] = (ObjectCounts[t] || 0) + 1;
            });
        });
        return ObjectCounts;
    }, [bookmarks]);

    const getCumulativeCount = (fId) => folderCounts[fId] || 0;
    const unsortedCount = useMemo(() => bookmarks.filter(b => isUnsortedFolder(b.folder)).length, [bookmarks]);

    const folderDescendantsMap = useMemo(() => {
        const map = {};
        customFolders.forEach(f => {
            map[f.name] = getFolderAndDescendants(f.id, customFolders);
        });
        return map;
    }, [customFolders, getFolderAndDescendants]);

    const filteredBookmarks = useMemo(() => {
        const source = activeFilters.includes('Trash') ? trash : bookmarks;
        const tagFilters = activeFilters.filter(f => f.startsWith('tag:'));
        const folderFilters = activeFilters.filter(f => !f.startsWith('tag:'));

        const filtered = source.filter(b => {
            // Tag logic: MUST match ALL selected tags (Intersection)
            const matchTags = tagFilters.every(filter => {
                const tagName = filter.split(':')[1];
                return (b.tags || []).includes(tagName);
            });

            // Folder logic: MUST match ANY selected folder or special view (Union)
            // If no specific folder filter is active (only tags), we allow all folders
            const matchFolders = folderFilters.length === 0 || folderFilters.some(filter => {
                if (filter === 'All' || filter === 'AllTags' || filter === 'Trash') return true;
                if (filter === 'Unsorted') return isUnsortedFolder(b.folder);
                const normalized = normalizeFolder(b.folder);
                return folderDescendantsMap[filter] ? folderDescendantsMap[filter].includes(normalized) : (normalized === filter);
            });

            const mF = matchTags && matchFolders;
            const s = debouncedSearchQuery.toLowerCase();
            return mF && (!s || (b.tags || []).some(t => t.includes(s)) || (b.description || '').toLowerCase().includes(s) || (b.tweetText || '').toLowerCase().includes(s) || (b.authorName || '').toLowerCase().includes(s));
        });
        // Sort newest first by timestamp or id
        return filtered.sort((a, b) => {
            const aTime = a.timestamp || parseInt(a.id) || 0;
            const bTime = b.timestamp || parseInt(b.id) || 0;
            return bTime - aTime;
        });
    }, [bookmarks, trash, activeFilters, debouncedSearchQuery, customFolders]);


    // Helper: check if targetId is a descendant of folderId
    const isDescendantOf = (targetId, folderId) => {
        const children = customFolders.filter(f => f.parentId === folderId);
        for (const child of children) {
            if (child.id === targetId) return true;
            if (isDescendantOf(targetId, child.id)) return true;
        }
        return false;
    };

    const FolderItem = ({ folder, depth = 0 }) => {
        const children = customFolders.filter(f => f.parentId === folder.id);
        const isExpanded = expandedFolders.includes(folder.id);
        const isActive = activeFilters.includes(folder.name);
        const isDragOver = dragOverFolderId === folder.id;
        return (
            <div className="w-full">
                <div
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); dragItemRef.current = { type: 'folder', id: folder.id }; }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolderId(folder.id); }}
                    onDragLeave={(e) => { e.stopPropagation(); if (dragOverFolderId === folder.id) setDragOverFolderId(null); }}
                    onDrop={(e) => {
                        e.preventDefault(); e.stopPropagation(); setDragOverFolderId(null);
                        const data = dragItemRef.current;
                        if (!data) return;
                        if (data.type === 'folder') {
                            // Can't drop on self, can't drop parent into its own descendant
                            if (data.id === folder.id) return;
                            if (isDescendantOf(folder.id, data.id)) return;
                            setCustomFolders(prev => prev.map(f => f.id === data.id ? { ...f, parentId: folder.id } : f));
                        } else if (data.type === 'tweet') {
                            setBookmarks(prev => prev.map(b => data.ids.includes(b.id) ? { ...b, folder: folder.name } : b));
                        }
                        dragItemRef.current = null;
                    }}
                    className={`group flex items-center rounded-xl transition-all cursor-pointer mx-1 ${isActive ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'} ${isDragOver ? 'ring-2 ring-blue-400 ring-inset bg-blue-50/70' : ''}`}
                    style={{ marginLeft: `${depth * 1 + 0.25}rem`, padding: '0.15rem 0', ...(isActive && !isDragOver ? { backgroundColor: accentColor } : {}) }}
                >
                    <button onClick={(e) => { e.stopPropagation(); setExpandedFolders(prev => prev.includes(folder.id) ? prev.filter(x => x !== folder.id) : [...prev, folder.id]); }} className={`w-5 h-5 ml-1 flex items-center justify-center ${children.length === 0 ? 'invisible' : ''}`}><LucideIcon name={isExpanded ? "chevron-down" : "chevron-right"} size={12} /></button>
                    <button onClick={() => toggleFilter(folder.name)} className="flex-1 flex items-center gap-2.5 text-[15px] font-bold truncate py-1.5 pl-1 text-left"><LucideIcon name="folder" className="text-[14px]" style={{ color: isActive ? '#fff' : folder.color }} /> <span>{folder.name}</span></button>
                    <div className="flex items-center w-8 justify-center pr-2 shrink-0"><span className="text-[11px] font-black opacity-60 group-hover:hidden">{getCumulativeCount(folder.id)}</span><button onClick={(e) => { e.stopPropagation(); setEditingFolder(folder); setFolderNameInput(folder.name); setFolderColorInput(folder.color); setIsFolderModalOpen(true); }} className="hidden group-hover:block text-slate-400 hover:text-blue-500"><LucideIcon name="pen" className="text-[11px]" /></button></div>
                </div>
                {isExpanded && children.map(c => <FolderItem key={c.id} folder={c} depth={depth + 1} />)}
            </div>
        );
    };

    const [windowWidthState, setWindowWidthState] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidthState(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const effectiveCols = useMemo(() => {
        const w = windowWidthState || window.innerWidth;
        if (w < 640) return 1;
        if (w < 1024) return Math.min(2, gridCols || 1);
        if (w < 1280) return Math.min(3, gridCols || 1);
        if (w < 1536) return Math.min(4, gridCols || 1);
        return gridCols || 1;
    }, [windowWidthState, gridCols]);

    const bookmarkColumns = useMemo(() => {
        const cols = Array.from({ length: effectiveCols }, () => []);
        if (filteredBookmarks && Array.isArray(filteredBookmarks)) {
            filteredBookmarks.slice(0, visibleCount).forEach((b, i) => {
                cols[i % effectiveCols].push(b);
            });
        }
        return cols;
    }, [filteredBookmarks, visibleCount, effectiveCols]);

    const gridConfig = {
        1: { padding: 'max-w-3xl' },
        2: { padding: 'max-w-5xl' },
        3: { padding: 'max-w-6xl' },
        4: { padding: 'max-w-[90rem]' },
        5: { padding: 'max-w-[120rem]' }
    }[gridCols] || { padding: 'max-w-6xl' };

    if (!isDbLoaded) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-50 flex-col gap-4">
                <LucideIcon name="loader" className="fa-spin text-4xl text-slate-300" />
                <p className="font-bold text-slate-500 uppercase tracking-widest text-sm">Loading Database...</p>
            </div>
        );
    }

    return (
        <div className={`flex h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden theme-${theme}`}>

            {/* MOBILE SIDEBAR OVERLAY */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-[80] sm:hidden">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
                    <aside className="relative w-72 h-full bg-white shadow-2xl flex flex-col animate-slide-in-left">
                        <div className="p-5 flex items-center justify-between border-b border-slate-50">
                            <div className="flex items-center gap-[5px]">
                                <LucideIcon name="bookmark" className="shrink-0 -translate-y-[1px]" style={{ color: theme === 'dark' ? '#fff' : '#000' }} size={45} strokeWidth={2.5} />
                                <div className="flex flex-col items-start">
                                    <h1 className="text-[28px] tracking-wide leading-[0.85] mb-1 whitespace-nowrap" style={{ fontFamily: '"Londrina Solid", sans-serif', fontWeight: 900, letterSpacing: '0.5px' }}>Bookmark Base</h1>
                                    <span className="text-[15px] text-slate-500 leading-none" style={{ fontFamily: '"Londrina Solid", sans-serif', fontWeight: 400, letterSpacing: '0.2px' }}>Save Your Feed</span>
                                </div>
                            </div>
                            <button onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full"><LucideIcon name="x" className="text-slate-400" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto py-6 px-5 space-y-6 custom-scrollbar">
                            <div className="space-y-0">
                                <div onClick={() => { toggleFilter('All'); setIsSidebarOpen(false); }} className={`mx-1 flex items-center rounded-xl transition-all cursor-pointer ${activeFilters.includes('All') ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`} style={activeFilters.includes('All') ? { backgroundColor: accentColor } : {}}>
                                    <button className="flex-1 flex items-center gap-3 px-3 py-2 text-[15px] font-bold text-left"><LucideIcon name="layers" size={18} /> All Bookmarks</button>
                                    <div className="flex items-center w-8 justify-center pr-2 shrink-0"><span className="text-[11px] font-black opacity-60">{bookmarks.length}</span></div>
                                </div>
                                <div onClick={() => { toggleFilter('Unsorted'); setIsSidebarOpen(false); }} className={`mx-1 flex items-center rounded-xl transition-all cursor-pointer ${activeFilters.includes('Unsorted') ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`} style={activeFilters.includes('Unsorted') ? { backgroundColor: accentColor } : {}}>
                                    <button className="flex-1 flex items-center gap-3 px-3 py-2 text-[15px] font-bold text-left"><LucideIcon name="inbox" size={18} /> Unsorted</button>
                                    <div className="flex items-center w-8 justify-center pr-2 shrink-0"><span className="text-[11px] font-black opacity-60">{unsortedCount}</span></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-3 px-2"><h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Folders</h2><button onClick={(e) => { e.stopPropagation(); setEditingFolder(null); setFolderNameInput(''); setFolderColorInput('#3b82f6'); setIsFolderModalOpen(true); }} className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center hover:text-black"><LucideIcon name="plus" size={12} /></button></div>
                                <div className="space-y-0">
                                    {customFolders.filter(f => !f.parentId).map(f => <FolderItem key={f.id} folder={f} />)}
                                </div>
                            </div>
                            <div>
                                <div className="group flex justify-between items-center mb-3 px-2 cursor-pointer tag-header transition-all py-1" onClick={() => setIsTagsExpanded(!isTagsExpanded)}>
                                    <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2"><LucideIcon name={isTagsExpanded ? "chevron-down" : "chevron-right"} size={10} /> Tags</h2>
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={(e) => { e.stopPropagation(); toggleFilter('AllTags'); setIsSidebarOpen(false); }} className="px-2 h-6 text-[10px] font-bold text-blue-500 bg-blue-50 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-colors">ALL</button>
                                        <button onClick={(e) => { e.stopPropagation(); setEditingTag(null); setTagNameInput(''); setTagColorInput('#64748b'); setIsTagModalOpen(true); }} className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center hover:text-black"><LucideIcon name="plus" size={12} /></button>
                                    </div>
                                </div>
                                {isTagsExpanded && (
                                    <div className="flex flex-wrap gap-1.5 px-2 mt-1">
                                        {[...customTags].sort((a, b) => (tagCounts[b.name] || 0) - (tagCounts[a.name] || 0)).map(tag => {
                                            const isActive = activeFilters.includes(`tag:${tag.name}`);
                                            return (
                                                <div
                                                    key={tag.id}
                                                    onClick={() => { toggleFilter(`tag:${tag.name}`); setIsSidebarOpen(false); }}
                                                    className={`h-7 flex items-center cursor-pointer rounded-lg transition-all px-2.5 border ${isActive ? 'text-white shadow-sm border-transparent' : 'text-slate-500 bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                                                    style={isActive ? { backgroundColor: accentColor } : {}}
                                                >
                                                    <span className="font-black mr-1.5 text-[11px] flex items-center" style={{ color: isActive ? '#fff' : tag.color }}>#</span>
                                                    <span className="text-[13px] font-bold flex items-center">{tag.name}</span>
                                                    <span className={`ml-2 text-[10px] font-black flex items-center h-full pt-[1px] ${isActive ? 'opacity-70' : 'opacity-30'}`}>{tagCounts[tag.name] || 0}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 space-y-3">
                            {/* Cloud Sync Status - Mobile */}
                            <div className={`p-3 rounded-2xl border transition-all ${user ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                                {user ? (
                                    <div className="flex items-center gap-3">
                                        {user.photoURL && <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-white shadow-sm" />}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-bold text-slate-800 truncate">{user.displayName || 'User'}</p>
                                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest leading-none">{isSyncing ? 'Syncing...' : 'Online'}</p>
                                        </div>
                                        <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors" title="Logout">
                                            <LucideIcon name="log-out" size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={handleLogin} className="w-full flex items-center justify-center gap-2 py-2 text-[13px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                        <LucideIcon name="cloud" size={16} /> Cloud Login
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { toggleFilter('Trash'); setIsSidebarOpen(false); }} className={`flex-1 flex items-center gap-2 px-3 py-2 text-[13px] font-bold rounded-xl ${activeFilters.includes('Trash') ? 'bg-red-50 text-red-500' : 'text-slate-400 hover:bg-slate-50'}`}><LucideIcon name="trash-2" size={18} /> Trash</button>
                                <button onClick={() => { setIsSettingsOpen(true); setIsSidebarOpen(false); }} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-xl"><LucideIcon name="settings" size={18} /></button>
                            </div>
                        </div>
                    </aside>
                </div>
            )}

            <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm hidden sm:flex">
                <div className="p-6 flex items-center gap-[5px] border-b border-slate-50">
                    <LucideIcon name="bookmark" className="shrink-0 -translate-y-[1px]" style={{ color: theme === 'dark' ? '#fff' : '#000' }} size={45} strokeWidth={2.5} />
                    <div className="flex flex-col items-start">
                        <h1 className="text-[28px] tracking-wide leading-[0.85] mb-1 whitespace-nowrap" style={{ fontFamily: '"Londrina Solid", sans-serif', fontWeight: 900, letterSpacing: '0.5px' }}>Bookmark Base</h1>
                        <span className="text-[15px] text-slate-500 leading-none" style={{ fontFamily: '"Londrina Solid", sans-serif', fontWeight: 400, letterSpacing: '0.2px' }}>Save Your Feed</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto py-6 px-5 space-y-6 custom-scrollbar">
                    <div className="space-y-0">
                        <div onClick={() => toggleFilter('All')} className={`mx-1 flex items-center rounded-xl transition-all cursor-pointer ${activeFilters.includes('All') ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`} style={activeFilters.includes('All') ? { backgroundColor: accentColor } : {}}>
                            <button className="flex-1 flex items-center gap-3 px-3 py-2 text-[15px] font-bold text-left"><LucideIcon name="layers" size={18} /> All Bookmarks</button>
                            <div className="flex items-center w-8 justify-center pr-2 shrink-0"><span className="text-[11px] font-black opacity-60">{bookmarks.length}</span></div>
                        </div>
                        <div onClick={() => toggleFilter('Unsorted')} className={`mx-1 flex items-center rounded-xl transition-all cursor-pointer ${activeFilters.includes('Unsorted') ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`} style={activeFilters.includes('Unsorted') ? { backgroundColor: accentColor } : {}}>
                            <button className="flex-1 flex items-center gap-3 px-3 py-2 text-[15px] font-bold text-left"><LucideIcon name="inbox" size={18} /> Unsorted</button>
                            <div className="flex items-center w-8 justify-center pr-2 shrink-0"><span className="text-[11px] font-black opacity-60">{unsortedCount}</span></div>
                        </div>
                    </div>
                    <div>
                        <div
                            className={`flex justify-between items-center mb-2 px-2 rounded-lg transition-all ${dragOverFolderId === 'root' ? 'bg-blue-50 ring-2 ring-blue-400 ring-dashed py-1' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); setDragOverFolderId('root'); }}
                            onDragLeave={() => { if (dragOverFolderId === 'root') setDragOverFolderId(null); }}
                            onDrop={(e) => {
                                e.preventDefault(); setDragOverFolderId(null);
                                const data = dragItemRef.current;
                                if (!data) return;
                                if (data.type === 'folder') {
                                    setCustomFolders(prev => prev.map(f => f.id === data.id ? { ...f, parentId: null } : f));
                                }
                                dragItemRef.current = null;
                            }}
                        >
                            <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Folders</h2>
                            <button onClick={() => { setEditingFolder(null); setFolderNameInput(''); setFolderColorInput('#3b82f6'); setIsFolderModalOpen(true); }} className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center hover:text-black"><LucideIcon name="plus" size={12} /></button>
                        </div>
                        <div className="space-y-0">{topLevelFolders.map(f => <FolderItem key={f.id} folder={f} />)}</div>
                    </div>
                    <div>
                        <div className="group flex justify-between items-center mb-3 px-2 cursor-pointer tag-header transition-all py-1" onClick={() => setIsTagsExpanded(!isTagsExpanded)}>
                            <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2"><LucideIcon name={isTagsExpanded ? "chevron-down" : "chevron-right"} size={10} /> Tags</h2>
                            <div className="flex items-center gap-1.5">
                                <button onClick={(e) => { e.stopPropagation(); toggleFilter('AllTags'); }} className="px-2 h-6 text-[10px] font-bold text-blue-500 bg-blue-50 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-colors">ALL</button>
                                <button onClick={(e) => { e.stopPropagation(); setEditingTag(null); setTagNameInput(''); setTagColorInput('#64748b'); setIsTagModalOpen(true); }} className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center hover:text-black"><LucideIcon name="plus" size={12} /></button>
                            </div>
                        </div>
                        {isTagsExpanded && (
                            <div className="flex flex-wrap gap-1.5 px-2 mt-1">
                                {customTags.length > 0 ? [...customTags].sort((a, b) => (tagCounts[b.name] || 0) - (tagCounts[a.name] || 0)).map(tag => {
                                    const isActive = activeFilters.includes(`tag:${tag.name}`);
                                    return (
                                        <div
                                            key={tag.id}
                                            onClick={() => toggleFilter(`tag:${tag.name}`)}
                                            className={`group h-8 flex items-center rounded-lg transition-all cursor-pointer px-3 py-0.5 border ${isActive ? 'text-white shadow-sm border-transparent' : 'text-slate-600 bg-slate-50 border-slate-100 hover:border-slate-200 hover:bg-slate-100'}`}
                                            style={isActive ? { backgroundColor: accentColor } : {}}
                                        >
                                            <span className="font-black text-[12px] mr-1.5 shrink-0 flex items-center" style={{ color: isActive ? '#fff' : tag.color }}>#</span>
                                            <span className="text-[14px] font-bold truncate max-w-[140px] flex items-center">{tag.name}</span>
                                            <div className="flex items-center justify-center ml-2 min-w-[14px] h-full">
                                                <span className={`text-[11px] font-black flex items-center pt-[1px] group-hover:hidden ${isActive ? 'opacity-70' : 'opacity-30'}`}>{tagCounts[tag.name] || 0}</span>
                                                <button onClick={(e) => { e.stopPropagation(); setEditingTag(tag); setTagNameInput(tag.name); setTagColorInput(tag.color); setIsTagModalOpen(true); }} className={`hidden group-hover:flex items-center hover:text-blue-500 ${isActive ? 'text-white' : 'text-slate-400'}`}><LucideIcon name="pen" size={11} /></button>
                                            </div>
                                        </div>
                                    );
                                }) : <div className="px-3 py-2 text-[11px] text-slate-400 italic">No tags yet</div>}
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 space-y-3">
                    {/* Cloud Sync Status - Desktop */}
                    <div className={`p-3 rounded-2xl border transition-all ${user ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                        {user ? (
                            <div className="flex items-center gap-3">
                                {user.photoURL && <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-white shadow-sm" />}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-slate-800 truncate">{user.displayName || 'User'}</p>
                                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest leading-none">{isSyncing ? 'Syncing...' : 'Online'}</p>
                                </div>
                                <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors" title="Logout">
                                    <LucideIcon name="log-out" size={14} />
                                </button>
                            </div>
                        ) : (
                            <button onClick={handleLogin} className="w-full flex items-center justify-center gap-2 py-2 text-[13px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                <LucideIcon name="cloud" size={16} /> Cloud Sync Login
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleExportJSON} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-all">
                            <LucideIcon name="download" className="text-[14px]" /> Save
                        </button>
                        <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer">
                            <LucideIcon name="upload" className="text-[14px]" /> Load
                            <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => toggleFilter('Trash')} className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-xl text-[15px] font-medium transition-all ${activeFilters.includes('Trash') ? 'bg-red-50 text-red-600' : 'text-slate-500 hover:bg-red-50'}`}><LucideIcon name="trash-2" size={18} /> Trash</button>
                        <button onClick={() => setIsSettingsOpen(true)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all shrink-0"><LucideIcon name="settings" size={18} className="text-sm" /></button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-screen min-w-0 bg-slate-50/50">
                <header className="h-16 sm:h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-40 shrink-0">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <button className="sm:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg shrink-0" onClick={() => setIsSidebarOpen(true)}><LucideIcon name="menu" /></button>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            {activeFilters.includes('All') || activeFilters.includes('AllTags') || activeFilters.includes('Trash') ? (
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 capitalize truncate">
                                    {activeFilters.includes('AllTags') ? 'All Tags' : activeFilters.includes('Trash') ? 'Trash' : 'All Bookmarks'}
                                </h2>
                            ) : (
                                activeFilters.map(filter => (
                                    <div key={filter} className="group flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-sm font-bold cursor-pointer hover:bg-red-50 hover:text-red-500 transition-all border border-transparent hover:border-red-200" onClick={() => toggleFilter(filter, true)}>
                                        {filter.startsWith('tag:') ? (
                                            <>
                                                <span className="font-black" style={{ color: customTags.find(t => t.name === filter.split(':')[1])?.color || '#64748b' }}>#</span>
                                                <span>{filter.split(':')[1]}</span>
                                            </>
                                        ) : filter === 'Unsorted' ? (
                                            <>
                                                <LucideIcon name="inbox" size={12} className="text-slate-400" />
                                                <span>Unsorted</span>
                                            </>
                                        ) : (
                                            <>
                                                <LucideIcon name="folder" size={13} style={{ color: customFolders.find(f => f.name === filter)?.color || '#94a3b8' }} />
                                                <span>{filter}</span>
                                            </>
                                        )}
                                        <LucideIcon name="x" className="ml-1 opacity-0 group-hover:opacity-100 w-3 h-3" />
                                    </div>
                                ))
                            )}

                            {!activeFilters.includes('Trash') && !activeFilters.includes('AllTags') && (
                                <div className="relative dropdown-container">
                                    <button onClick={(e) => { e.stopPropagation(); setActiveAddMenu(activeAddMenu === 'headerFilter' ? null : 'headerFilter'); }} className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-all shadow-sm shrink-0"><LucideIcon name="plus" size={14} /></button>
                                    {activeAddMenu === 'headerFilter' && (
                                        <div className="absolute top-full left-0 mt-3 w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] p-4 flex gap-6" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex-1 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-3 tracking-widest">Folders</div>
                                                <div className="space-y-0.5">
                                                    {!activeFilters.includes('All') && (
                                                        <div onClick={(e) => { e.stopPropagation(); toggleFilter('All', true); setActiveAddMenu(null); }} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-xl cursor-pointer text-sm font-bold text-slate-700 transition-colors">
                                                            <LucideIcon name="layers" size={14} className="text-slate-400" /> All Bookmarks
                                                        </div>
                                                    )}
                                                    {!activeFilters.includes('Unsorted') && (
                                                        <div onClick={(e) => { e.stopPropagation(); toggleFilter('Unsorted', true); setActiveAddMenu(null); }} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-xl cursor-pointer text-sm font-bold text-slate-700 transition-colors">
                                                            <LucideIcon name="inbox" size={14} className="text-slate-400" /> Unsorted
                                                        </div>
                                                    )}
                                                    {customFolders.filter(f => !activeFilters.includes(f.name)).map(f => (
                                                        <div key={f.name} onClick={(e) => { e.stopPropagation(); toggleFilter(f.name, true); setActiveAddMenu(null); }} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-xl cursor-pointer text-sm font-bold text-slate-700 transition-colors">
                                                            <LucideIcon name="folder" size={14} style={{ color: f.color }} />
                                                            {f.name}
                                                        </div>
                                                    ))}
                                                    {customFolders.filter(f => !activeFilters.includes(f.name)).length === 0 && activeFilters.includes('All') && activeFilters.includes('Unsorted') && (
                                                        <div className="px-3 py-2 text-xs text-slate-400 italic">No more folders</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="w-px bg-slate-100 self-stretch"></div>

                                            <div className="flex-1 max-h-72 overflow-y-auto custom-scrollbar pl-1">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-3 tracking-widest">Tags</div>
                                                <div className="space-y-0.5">
                                                    {customTags.filter(t => !activeFilters.includes(`tag:${t.name}`)).length > 0 ? (
                                                        customTags
                                                            .filter(t => !activeFilters.includes(`tag:${t.name}`))
                                                            .sort((a, b) => (tagCounts[b.name] || 0) - (tagCounts[a.name] || 0))
                                                            .map(t => (
                                                                <div key={t.id} onClick={(e) => { e.stopPropagation(); toggleFilter(`tag:${t.name}`, true); setActiveAddMenu(null); }} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-xl cursor-pointer text-sm font-bold text-slate-700 transition-colors">
                                                                    <span className="font-black" style={{ color: t.color }}>#</span>
                                                                    {t.name}
                                                                </div>
                                                            ))
                                                    ) : (
                                                        <div className="px-3 py-2 text-xs text-slate-400 italic">No more tags</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="relative hidden md:block">
                            <LucideIcon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-11 pr-4 py-2.5 bg-slate-100 border-transparent rounded-full text-sm w-48 focus:w-80 focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-slate-50 outline-none transition-all" />
                        </div>
                        <div className="h-8 w-[1px] bg-slate-100 mx-1 hidden md:block"></div>
                        <div className="relative" tabIndex="0" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsGridMenuOpen(false); }}>
                            <button onClick={() => setIsGridMenuOpen(!isGridMenuOpen)} className="flex items-center gap-2 bg-slate-100 px-3 sm:px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-200 focus:outline-none transition-colors"><LucideIcon name="columns" /><span className="hidden sm:inline"> {gridCols} Column</span></button>
                            {isGridMenuOpen && <div className="absolute right-0 top-full mt-2 w-32 bg-white border border-slate-100 shadow-xl rounded-xl overflow-hidden z-[60]">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => { setGridCols(n); setIsGridMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold ${gridCols === n ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>{n} Column</button>)}</div>}
                        </div>
                        {activeFilters.includes('Trash') ? (
                            <button onClick={handleClearTrash} className="text-white bg-red-500 px-5 py-2.5 rounded-full text-xs font-bold hover:bg-red-600 transition-all shadow-md active:scale-95 flex items-center"><LucideIcon name="trash-2" size={18} className="mr-2" /> CLEAR ALL</button>
                        ) : (
                            <button onClick={() => setIsModalOpen(true)} className="text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-bold hover:opacity-90 transition-all shadow-md active:scale-95 flex items-center" style={{ backgroundColor: accentColor }}><LucideIcon name="plus" className="sm:mr-2" /><span className="hidden sm:inline"> NEW</span></button>
                        )}
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 custom-scrollbar">
                    {activeFilters.includes('AllTags') ? (
                        <div className="mx-auto max-w-4xl">
                            <div className="mb-8">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><LucideIcon name="tags" className="text-slate-500" /></div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">Tag Collection</h3>
                                        <p className="text-sm text-slate-400 font-medium">{customTags.length} tag{customTags.length !== 1 ? 's' : ''} in your archive</p>
                                    </div>
                                </div>
                            </div>
                            {customTags.length > 0 ? (
                                <div className="flex flex-wrap gap-3">
                                    {customTags.map(tag => {
                                        const count = tagCounts[tag.name] || 0;
                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => toggleFilter(`tag:${tag.name}`)}
                                                className="group flex items-center gap-2.5 px-5 py-3 rounded-2xl text-[14px] font-bold transition-all active:scale-95 border bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5"
                                            >
                                                <span className="font-black text-[16px]" style={{ color: tag.color }}>#</span>
                                                <span>{tag.name}</span>
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 ml-1">{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                                    <LucideIcon name="tags" className="text-4xl mb-4" />
                                    <p className="text-sm font-bold uppercase tracking-widest">No Tags Yet</p>
                                    <p className="text-xs mt-2">Tags will appear here as you add them to your bookmarks</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className={`mx-auto ${gridConfig.padding}`}>
                                <div className="flex gap-3 sm:gap-6 items-start justify-center">
                                    {bookmarkColumns.map((col, colIdx) => (
                                        <div key={colIdx} className="flex-1 flex flex-col gap-3 sm:gap-6 min-w-0">
                                            {col.map(b => (
                                                <div key={b.id} draggable onDragStart={(e) => { e.stopPropagation(); dragItemRef.current = { type: 'tweet', ids: [b.id] }; }} onClick={() => { if (!activeFilters.includes('Trash')) { setFocusedTweet(b); setInitialFocusedTweet(b); setIsNoteEditing(false); } }} className={`group bg-white rounded-[1.25rem] sm:rounded-[1.5rem] border ${showBrandLines && brandLineStyle === 'border' ? (b.url && b.url.includes('reddit.com') ? 'border-[#ff4500]' : 'border-[#1da1f2]') : 'border-slate-200'} shadow-sm overflow-hidden relative w-full transition-all duration-300 ${activeFilters.includes('Trash') ? 'opacity-70' : ''} hover:border-slate-400 p-3 sm:p-4`}>
                                                    <div className="w-full">{b.tweetText ? <CustomTweetCard bookmark={b} onImageClick={handleImageClick} /> : (b.url && b.url.includes('reddit.com') ? <RedditEmbed url={b.url} /> : <TweetEmbed tweetId={b.tweetId} />)}</div>

                                                    <div className="mt-4 space-y-3">
                                                        {b.description && <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-2xl"><p className="text-[13px] font-medium text-slate-700 leading-relaxed line-clamp-3 break-words">{b.description}</p></div>}

                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleFilter(getFolderLabel(b.folder));
                                                                    }}
                                                                    className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap hover:bg-slate-200 transition-colors"
                                                                >
                                                                    <LucideIcon name="folder" className="mr-1" size={12} style={{ color: customFolders.find(f => f.name === normalizeFolder(b.folder))?.color || '#94a3b8' }} /> {getFolderLabel(b.folder)}
                                                                </button>
                                                                {(b.tags || []).map(tag => {
                                                                    const tO = customTags.find(t => t.name === tag);
                                                                    return (
                                                                        <button
                                                                            key={tag}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleFilter(`tag:${tag}`);
                                                                            }}
                                                                            className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 text-slate-500 rounded-lg text-[10px] font-semibold truncate hover:bg-slate-100 transition-colors"
                                                                        >
                                                                            <span className="font-black" style={{ color: tO?.color || '#64748b' }}>#</span>{tag}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {activeFilters.includes('Trash') ? (
                                                                    <div className="flex gap-2"><button onClick={(e) => handleRestoreFromTrash(e, b.id)} className="text-green-500 hover:text-green-600"><LucideIcon name="rotate-ccw" /></button><button onClick={(e) => handlePermanentDelete(e, b.id)} className="text-red-500 hover:text-red-700"><LucideIcon name="trash-2" size={18} /></button></div>
                                                                ) : (
                                                                    <button onClick={(e) => handleMoveToTrash(e, b.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-600 transition-all p-1"><LucideIcon name="trash-2" size={18} className="text-[13px]" /></button>
                                                                )}
                                                                <a href={b.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-black rounded-lg transition-all"><LucideIcon name="external-link" size={12} /></a>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {showBrandLines && brandLineStyle === 'bar' && (
                                                        <div className="absolute bottom-0 left-0 right-0 h-[6px]" style={{ backgroundColor: b.url && b.url.includes('reddit.com') ? '#ff4500' : '#1da1f2' }}></div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {filteredBookmarks.length > visibleCount && <div ref={observerTarget} className="h-10 w-full" />}
                            {filteredBookmarks.length === 0 && <div className="flex flex-col items-center justify-center py-20 opacity-30"><LucideIcon name="layers" size={18} className="text-4xl mb-4" /><p className="text-sm font-bold uppercase tracking-widest">No Content Found</p></div>}
                        </>
                    )}
                </div>
            </main>

            {/* EDIT (FOCUS) MODAL */}
            {
                focusedTweet && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4 md:p-8 overflow-y-auto" onClick={() => setFocusedTweet(null)}>
                        <div className="bg-white w-full max-w-5xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden modal-enter flex flex-col md:flex-row h-fit max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
                            <div className="flex-1 bg-slate-100 p-4 sm:p-8 md:p-12 lg:p-16 overflow-y-auto custom-scrollbar flex items-start justify-center min-h-[200px] sm:min-h-[400px]">
                                <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-5">
                                    {focusedTweet.tweetText ? <CustomTweetCard bookmark={focusedTweet} onImageClick={(medias, idx, type, poster) => setPreviewState({ medias, currentIndex: idx, mediaType: type || focusedTweet.mediaType, poster })} /> : (focusedTweet.url && focusedTweet.url.includes('reddit.com') ? <RedditEmbed url={focusedTweet.url} /> : <TweetEmbed tweetId={focusedTweet.tweetId} key={`focus-${focusedTweet.id}`} />)}
                                </div>
                            </div>
                            <div className="w-full md:w-[350px] p-5 sm:p-8 border-l border-slate-100 flex flex-col justify-between bg-white overflow-y-auto custom-scrollbar relative">
                                <div onClick={() => { if (activeAddMenu) setActiveAddMenu(null); }}>
                                    <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                                        <div>
                                            {focusedTweet.date && <span className="text-[11px] text-slate-400 font-medium flex items-center"><LucideIcon name="calendar" className="mr-1.5" size={12} />{formatDate(focusedTweet.date)}</span>}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {initialFocusedTweet && JSON.stringify({ ...initialFocusedTweet, date: null, timestamp: null }) !== JSON.stringify({ ...focusedTweet, date: null, timestamp: null }) && (
                                                <button onClick={() => {
                                                    setFocusedTweet(initialFocusedTweet);
                                                    setBookmarks(prev => prev.map(b => b.id === initialFocusedTweet.id ? initialFocusedTweet : b));
                                                }} className="w-8 h-8 flex items-center justify-center hover:bg-orange-50 text-orange-400 rounded-full transition-all" title="Revert Changes"><LucideIcon name="rotate-ccw" className="text-[16px]" /></button>
                                            )}
                                            <button onClick={() => { setFocusedTweet(null); setIsNoteEditing(false); }} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition-all text-slate-400"><LucideIcon name="x" className="text-xl" /></button>
                                        </div>
                                    </div>

                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Your Note</h3>
                                    {isNoteEditing ? (
                                        <textarea
                                            autoFocus
                                            value={focusedTweet.description || ''}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const updated = { ...focusedTweet, description: val };
                                                setFocusedTweet(updated);
                                                setBookmarks(prev => prev.map(b => b.id === updated.id ? updated : b));
                                            }}
                                            onBlur={() => setIsNoteEditing(false)}
                                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:ring-1 focus:ring-blue-400 mb-5"
                                            rows="4"
                                            placeholder="Empty note..."
                                        />
                                    ) : (
                                        <div onClick={(e) => { e.stopPropagation(); setIsNoteEditing(true); }} className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-5 cursor-text hover:bg-slate-100 hover:border-slate-200 transition-colors min-h-[80px]">
                                            <p className="text-slate-800 font-medium leading-relaxed break-words whitespace-pre-wrap">{focusedTweet.description || <span className="text-slate-400 italic">No note added. Click to write...</span>}</p>
                                        </div>
                                    )}

                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Folder</h3>
                                    <div className="flex flex-wrap gap-2 mb-5 relative">
                                        {!isUnsortedFolder(focusedTweet.folder) ? (
                                            <div className="group flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold cursor-pointer hover:bg-red-50 hover:text-red-500 transition-all border border-transparent hover:border-red-200" onClick={() => {
                                                const updated = { ...focusedTweet, folder: null };
                                                setFocusedTweet(updated);
                                                setBookmarks(prev => prev.map(b => b.id === updated.id ? updated : b));
                                            }}>
                                                <LucideIcon name="folder" size={14} style={{ color: customFolders.find(f => f.name === normalizeFolder(focusedTweet.folder))?.color || '#94a3b8' }} />
                                                <span>{normalizeFolder(focusedTweet.folder)}</span>
                                                <LucideIcon name="x" className="ml-1 opacity-0 group-hover:opacity-100 w-3 h-3" />
                                            </div>
                                        ) : (
                                            <div className="relative dropdown-container">
                                                <button onClick={(e) => { e.stopPropagation(); setActiveAddMenu(activeAddMenu === 'folder' ? null : 'folder'); }} className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-all"><LucideIcon name="plus" size={14} /></button>
                                                {activeAddMenu === 'folder' && (
                                                    <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 max-h-48 overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-1 mt-1">Select Folder</div>
                                                        {customFolders.length > 0 ? customFolders.map(f => (
                                                            <div key={f.name} onClick={(e) => {
                                                                e.stopPropagation();
                                                                const updated = { ...focusedTweet, folder: f.name };
                                                                setFocusedTweet(updated);
                                                                setBookmarks(prev => prev.map(b => b.id === updated.id ? updated : b));
                                                                setActiveAddMenu(null);
                                                            }} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer text-sm font-medium text-slate-700">
                                                                <LucideIcon name="folder" size={14} style={{ color: f.color }} />
                                                                {f.name}
                                                            </div>
                                                        )) : <div className="px-3 py-2 text-xs text-slate-400 italic">No custom folders.</div>}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tags</h3>
                                    <div className="flex flex-wrap gap-2 mb-5 relative dropdown-container">
                                        {(focusedTweet.tags || []).length > 0 && (focusedTweet.tags || []).map(tag => (
                                            <div key={tag} className="group flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold cursor-pointer hover:bg-red-50 hover:text-red-500 transition-all border border-transparent hover:border-red-200" onClick={() => {
                                                const newTags = (focusedTweet.tags || []).filter(t => t !== tag);
                                                const updated = { ...focusedTweet, tags: newTags };
                                                setFocusedTweet(updated);
                                                setBookmarks(prev => prev.map(b => b.id === updated.id ? updated : b));
                                            }}>
                                                <span className="font-black" style={{ color: customTags.find(t => t.name === tag)?.color || '#64748b' }}>#</span>
                                                <span>{tag}</span>
                                                <LucideIcon name="x" className="ml-1 opacity-0 group-hover:opacity-100 w-3 h-3" />
                                            </div>
                                        ))}
                                        <div className="relative dropdown-container">
                                            <button onClick={(e) => { e.stopPropagation(); setActiveAddMenu(activeAddMenu === 'tag' ? null : 'tag'); }} className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-all"><LucideIcon name="plus" size={14} /></button>
                                            {activeAddMenu === 'tag' && (
                                                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 max-h-48 overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-1 mt-1 flex justify-between items-center">
                                                        Select Tag
                                                    </div>
                                                    {customTags.filter(t => !(focusedTweet.tags || []).includes(t.name)).length > 0 ? customTags.filter(t => !(focusedTweet.tags || []).includes(t.name)).map(t => (
                                                        <div key={t.id} onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newTags = [...(focusedTweet.tags || []), t.name];
                                                            const updated = { ...focusedTweet, tags: newTags };
                                                            setFocusedTweet(updated);
                                                            setBookmarks(prev => prev.map(b => b.id === updated.id ? updated : b));
                                                            setActiveAddMenu(null);
                                                        }} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer text-sm font-medium text-slate-700">
                                                            <span className="font-black" style={{ color: t.color }}>#</span>
                                                            {t.name}
                                                        </div>
                                                    )) : <div className="px-3 py-2 text-xs text-slate-400 italic">No more tags</div>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-5 border-t border-slate-50 flex items-center gap-3 mt-auto">
                                    <button
                                        onClick={(e) => { handleMoveToTrash(e, focusedTweet.id); setFocusedTweet(null); }}
                                        className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all active:scale-95 shrink-0"
                                        title="Move to Trash"
                                    >
                                        <LucideIcon name="trash-2" size={17} />
                                    </button>
                                    <a href={focusedTweet.url} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-black text-white px-4 py-3 rounded-xl text-xs font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-95">
                                        {focusedTweet.url && focusedTweet.url.includes('reddit.com') ? 'OPEN ON REDDIT' : 'OPEN ON X'} <LucideIcon name="external-link" size={14} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* TAG MODAL */}
            {
                isTagModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setIsTagModalOpen(false)}>
                        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl modal-enter" onClick={(e) => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center"><h3 className="font-bold text-slate-900">{editingTag ? 'Edit Tag' : 'New Tag'}</h3><button onClick={() => setIsTagModalOpen(false)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition-all"><LucideIcon name="x" className="text-slate-400" /></button></div>
                            <form onSubmit={handleSaveTag} className="p-6 space-y-4">
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tag Name</label><input type="text" required value={tagNameInput} onChange={e => setTagNameInput(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:bg-white outline-none transition-all" /></div>
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Pick a Color</label><div className="flex items-center gap-3"><input type="color" value={tagColorInput} onChange={e => setTagColorInput(e.target.value)} className="w-12 h-12 p-1 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer shadow-sm" /> <span className="text-sm font-medium text-slate-600 uppercase font-mono">{tagColorInput}</span></div></div>
                                <div className="flex gap-2 pt-4"><button type="submit" className="flex-1 bg-green-600 text-white py-3.5 rounded-xl font-bold text-xs shadow-md shadow-green-600/20 hover:bg-green-700 transition-all active:scale-95">SAVE</button>{editingTag && <button type="button" onClick={() => { if (window.confirm("Delete this tag?")) { setCustomTags(prev => prev.filter(t => t.id !== editingTag.id)); setBookmarks(prev => prev.map(b => ({ ...b, tags: (b.tags || []).filter(tag => tag !== editingTag.name) }))); setIsTagModalOpen(false); } }} className="flex-1 bg-red-50 text-red-500 py-3.5 rounded-xl font-bold text-xs hover:bg-red-100 transition-all active:scale-95">DELETE</button>}</div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* ADD MODAL */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl modal-enter">
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center"><h3 className="font-bold text-slate-900">Add New Bookmark</h3><button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition-all"><LucideIcon name="x" className="text-slate-400" /></button></div>
                            <form onSubmit={handleAddBookmark} className="p-6 space-y-4">
                                <input type="url" required placeholder="Tweet URL (https://x.com/...)" value={newUrl} onChange={e => setNewUrl(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:bg-white outline-none transition-all" />
                                <div className="grid grid-cols-2 gap-4">
                                    <CustomDropdown value={newFolder} onChange={setNewFolder} options={[{ name: 'Unsorted', color: '#94a3b8' }, ...customFolders]} isMulti={false} />
                                    <CustomDropdown value={newTags} onChange={setNewTags} options={customTags} isMulti={true} />
                                </div>
                                <textarea placeholder="Your Note..." rows="3" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:bg-white outline-none resize-none transition-all" ></textarea>
                                <button type="submit" className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-sm shadow-md shadow-green-600/20 hover:bg-green-700 transition-all active:scale-95">Add to Collection</button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* PREVIEW MODAL */}
            {
                previewState && (
                    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[200] flex items-center justify-center p-4 cursor-zoom-out modal-enter" onClick={() => setPreviewState(null)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowRight' && previewState.medias.length > 1) { e.stopPropagation(); setPreviewState(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.medias.length })); }
                            if (e.key === 'ArrowLeft' && previewState.medias.length > 1) { e.stopPropagation(); setPreviewState(prev => ({ ...prev, currentIndex: (prev.currentIndex - 1 + prev.medias.length) % prev.medias.length })); }
                            if (e.key === 'Escape') setPreviewState(null);
                        }} tabIndex={0} ref={(el) => el && el.focus()}
                    >
                        {/* Left Arrow */}
                        {previewState.medias.length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); setPreviewState(prev => ({ ...prev, currentIndex: (prev.currentIndex - 1 + prev.medias.length) % prev.medias.length })); }} className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/25 text-white rounded-full transition-all backdrop-blur-sm z-10"><LucideIcon name="chevron-left" className="text-lg" /></button>
                        )}
                        {/* Media */}
                        {previewState.mediaType === 'video' ? <HlsVideoPlayer src={previewState.medias[previewState.currentIndex]} poster={previewState.poster} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg shadow-2xl outline-none" onClick={(e) => e.stopPropagation()} /> : <img src={getHighResUrl(previewState.medias[previewState.currentIndex])} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />}
                        {/* Right Arrow */}
                        {previewState.medias.length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); setPreviewState(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.medias.length })); }} className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/25 text-white rounded-full transition-all backdrop-blur-sm z-10"><LucideIcon name="chevron-right" className="text-lg" /></button>
                        )}
                        {/* Counter */}
                        {previewState.medias.length > 1 && (
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-4 py-2 rounded-full">{previewState.currentIndex + 1} / {previewState.medias.length}</div>
                        )}
                        {/* Top bar buttons */}
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(getHighResUrl(previewState.medias[previewState.currentIndex])); }} className="absolute top-6 right-20 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/30 text-white rounded-full transition-colors"><LucideIcon name="download" /></button>
                        <button onClick={() => setPreviewState(null)} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/30 text-white rounded-full transition-colors"><LucideIcon name="x" className="text-xl" /></button>
                    </div>
                )
            }

            {/* FOLDER MODAL */}
            {
                isFolderModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setIsFolderModalOpen(false)}>
                        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl modal-enter" onClick={(e) => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center"><h3 className="font-bold text-slate-900">{editingFolder ? 'Edit Folder' : 'New Folder'}</h3><button onClick={() => setIsFolderModalOpen(false)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition-all"><LucideIcon name="x" className="text-slate-400" /></button></div>
                            <form onSubmit={handleSaveFolder} className="p-6 space-y-4">
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Name</label><input type="text" required value={folderNameInput} onChange={e => setFolderNameInput(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:bg-white outline-none transition-all" /></div>
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Color</label><div className="flex items-center gap-3"><input type="color" value={folderColorInput} onChange={e => setFolderColorInput(e.target.value)} className="w-12 h-12 p-1 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer shadow-sm" /> <span className="text-sm font-medium uppercase">{folderColorInput}</span></div></div>
                                <div className="flex gap-2 pt-4"><button type="submit" className="flex-1 bg-green-600 text-white py-3.5 rounded-xl font-bold text-xs shadow-md shadow-green-600/20 hover:bg-green-700 transition-all active:scale-95">SAVE</button>{editingFolder && <button type="button" onClick={() => { if (window.confirm("Delete this folder?")) { setCustomFolders(prev => prev.filter(f => f.id !== editingFolder.id)); setBookmarks(prev => prev.map(b => b.folder === editingFolder.name ? { ...b, folder: null } : b)); setIsFolderModalOpen(false); } }} className="flex-1 bg-red-50 text-red-500 py-3.5 rounded-xl font-bold text-xs hover:bg-red-100 transition-all active:scale-95">DELETE</button>}</div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                isSettingsOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setIsSettingsOpen(false)}>
                        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl modal-enter" onClick={(e) => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center"><h3 className="font-bold text-slate-900 text-lg">Settings</h3><button onClick={() => setIsSettingsOpen(false)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition-all"><LucideIcon name="x" className="text-slate-400" /></button></div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Accent Color</label>
                                        {customAccentColors.length > 2 && (
                                            <button
                                                onClick={() => setIsEditingColors(!isEditingColors)}
                                                className={`text-[10px] font-bold uppercase transition-colors px-2 py-1 rounded-md ${isEditingColors ? 'bg-blue-100 text-blue-600' : 'text-blue-500 hover:bg-slate-50'}`}
                                            >
                                                {isEditingColors ? 'Bitti' : 'Düzenle'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {customAccentColors.map((colorObj, i) => (
                                            <div key={colorObj.id} className="relative group/col">
                                                {isEditingColors && i > 1 ? (
                                                    <div className={`relative w-9 h-9 rounded-xl transition-all shadow-sm border-2 border-white ring-2 ring-blue-200 overflow-hidden ${colorEditingIndex === i ? 'scale-110 ring-blue-400' : 'opacity-60'}`}>
                                                        <div className="w-full h-full pointer-events-none" style={{ backgroundColor: colorObj.color }}></div>
                                                        <input
                                                            type="color"
                                                            defaultValue={colorObj.color}
                                                            className="absolute -inset-4 w-[200%] h-[200%] opacity-0 cursor-pointer color-picker-input"
                                                            onFocus={() => setColorEditingIndex(i)}
                                                            onInput={(e) => {
                                                                // Sadece görseli anlık güncelleyelim, state'e dokunmayalım
                                                                e.target.previousSibling.style.backgroundColor = e.target.value;
                                                            }}
                                                            onChange={(e) => {
                                                                // OnChange (seçim bitince) ana listeyi güncelleyelim
                                                                const newCols = [...customAccentColors];
                                                                newCols[i].color = e.target.value;
                                                                setCustomAccentColors(newCols);
                                                                localStorage.setItem('customAccentColors', JSON.stringify(newCols));
                                                            }}
                                                            onBlur={(e) => {
                                                                setAccentColor(e.target.value);
                                                                setIsEditingColors(false);
                                                                setColorEditingIndex(null);
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setAccentColor(colorObj.color)} className={`w-9 h-9 rounded-xl transition-all shadow-sm hover:scale-110 ${accentColor === colorObj.color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`} style={{ backgroundColor: colorObj.color }}></button>
                                                )}

                                                {isEditingColors && i > 1 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newCols = customAccentColors.filter((_, idx) => idx !== i);
                                                            setCustomAccentColors(newCols);
                                                            localStorage.setItem('customAccentColors', JSON.stringify(newCols));
                                                            if (accentColor === colorObj.color) setAccentColor(newCols[0]?.color || '#000000');
                                                            if (newCols.length <= 2) setIsEditingColors(false);
                                                        }}
                                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex justify-center items-center shadow-sm transition-all scale-100 z-10 hover:bg-red-600"
                                                    >
                                                        <LucideIcon name="x" size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {customAccentColors.length < 9 && (
                                            <button
                                                onClick={() => {
                                                    const newColorObj = {
                                                        id: Date.now(),
                                                        color: '#3b82f6'
                                                    };

                                                    setCustomAccentColors(prev => [...prev, newColorObj]);
                                                    setAccentColor(newColorObj.color);
                                                    setIsEditingColors(true);
                                                    setColorEditingIndex(customAccentColors.length);
                                                    setTimeout(() => {
                                                        const inputs = document.querySelectorAll('.color-picker-input');
                                                        if (inputs.length > 0) {
                                                            inputs[inputs.length - 1].click();
                                                        }
                                                    }, 50);
                                                }}
                                                className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-all shadow-sm hover:bg-slate-200 bg-slate-100 cursor-pointer text-slate-500 overflow-hidden"
                                            >
                                                <LucideIcon name="plus" size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-50">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Display Theme</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { id: 'light', name: 'Light', bg: '#f8fafc', text: '#0f172a', border: '#e2e8f0' },
                                            { id: 'dark', name: 'Classic Dark', bg: '#15202b', text: '#ffffff', border: '#38444d' },
                                            { id: 'oldschool', name: 'Old School', bg: '#000000', text: '#d9d9d9', border: '#2f3336' }
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setTheme(t.id)}
                                                className={`relative overflow-hidden group p-3 rounded-2xl border-2 transition-all flex flex-col gap-2 items-center ${theme === t.id ? 'border-blue-500 bg-blue-50/10' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                                            >
                                                <div className="w-full h-8 rounded-lg shadow-inner flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: t.bg, color: t.text, border: `1px solid ${t.border}` }}>
                                                    Aa
                                                </div>
                                                <span className={`text-[11px] font-bold ${theme === t.id ? 'text-blue-600' : 'text-slate-500'}`}>{t.name}</span>
                                                {theme === t.id && (
                                                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                                                        <LucideIcon name="check" className="text-[8px] text-white" />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-slate-50">
                                    <div className="flex justify-between items-center mb-4">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Storage Usage</label>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${(storageInfo.used / (1024 * 1024)) < 80 ? 'bg-green-100 text-green-600' : (storageInfo.used / (1024 * 1024)) < 90 ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                                            {(storageInfo.used / (1024 * 1024)) < 80 ? 'OPTIMIZED' : (storageInfo.used / (1024 * 1024)) < 90 ? 'HEAVY' : 'CRITICAL'}
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-xs font-bold text-slate-700">Archive Size</span>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {(storageInfo.used / (1024 * 1024)).toFixed(2)} MB / 100 MB
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-700 ${(storageInfo.used / (1024 * 1024)) < 80 ? 'bg-green-500' : (storageInfo.used / (1024 * 1024)) < 90 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                style={{ width: `${Math.min((storageInfo.used / (1024 * 1024 * 100)) * 100, 100) || 0}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-50 font-sans">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Marka Çizgisi Ekleme</label>
                                    <div className="flex gap-2 mb-6">
                                        <button
                                            onClick={() => { setShowBrandLines(false); }}
                                            className={`flex-1 py-2.5 px-3 rounded-xl text-[11px] font-bold transition-all border ${!showBrandLines ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}
                                        >
                                            Kapalı
                                        </button>
                                        <button
                                            onClick={() => { setShowBrandLines(true); setBrandLineStyle('bar'); }}
                                            className={`flex-1 py-2.5 px-3 rounded-xl text-[11px] font-bold transition-all border ${showBrandLines && brandLineStyle === 'bar' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}
                                        >
                                            Alt Çizgi
                                        </button>
                                        <button
                                            onClick={() => { setShowBrandLines(true); setBrandLineStyle('border'); }}
                                            className={`flex-1 py-2.5 px-3 rounded-xl text-[11px] font-bold transition-all border ${showBrandLines && brandLineStyle === 'border' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}
                                        >
                                            Kenarlık
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Automatic Backup</label>
                                        <div
                                            onClick={() => setAutoBackup(!autoBackup)}
                                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-all duration-300 ${autoBackup ? 'bg-green-500' : 'bg-slate-200'}`}
                                        >
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${autoBackup ? 'left-5.5' : 'left-0.5'}`} style={{ left: autoBackup ? '22px' : '2px' }}></div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic pr-8 mb-6">
                                        Automatically creates a JSON backup file once a day when you open the app.
                                    </p>

                                    <div className="space-y-2 mt-4">
                                        <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 cursor-pointer group transition-all" onClick={() => handleExportJSON()}>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">Manual Export</span>
                                                <span className="text-[10px] font-medium text-slate-400">Download a JSON backup manually.</span>
                                            </div>
                                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 group-hover:bg-blue-100 text-slate-400 group-hover:text-blue-500 transition-all">
                                                <LucideIcon name="download" size={14} />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-3 rounded-xl border border-red-50 hover:border-red-100 hover:bg-red-50 cursor-pointer group transition-all" onClick={() => {
                                            setIsSettingsOpen(false);
                                            setIsWipeModalOpen(true);
                                        }}>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-red-500 group-hover:text-red-600 transition-colors">Wipe Database</span>
                                                <span className="text-[10px] font-medium text-red-400/80">Clear all archived data permanently.</span>
                                            </div>
                                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 group-hover:bg-red-200 text-red-400 group-hover:text-red-600 transition-all">
                                                <LucideIcon name="trash-2" size={14} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isWipeModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 modal-enter" onClick={() => setIsWipeModalOpen(false)}>
                        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl text-center" onClick={e => e.stopPropagation()}>
                            <div className="p-8">
                                <div className="w-16 h-16 bg-red-50 border-4 border-white shadow-sm text-red-500 rounded-full flex items-center justify-center mx-auto mb-5">
                                    <LucideIcon name="alert-triangle" size={28} />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">Bütün Veritabanı Silinecek!</h3>
                                <p className="text-[13px] text-slate-500 mb-8 px-2 leading-relaxed">Bu işlem geri alınamaz. Arşivlenen tüm içerikleriniz kalıcı olarak gidecek. Onaylıyor musunuz?</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setIsWipeModalOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95">İptal</button>
                                    <button onClick={() => {
                                        setIsWipeModalOpen(false);
                                        db.bookmarks.clear();
                                        db.folders.clear();
                                        db.tags.clear();
                                        db.trash.clear();
                                        window.location.reload();
                                    }} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-red-500/20 transition-all active:scale-95">Evet, Sil</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* TOAST NOTIFICATIONS */}
            {toasts.length > 0 && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 sm:bottom-6 z-[300] flex flex-col gap-2.5 pointer-events-none w-[calc(100%-2rem)] sm:w-auto">
                    {toasts.map(toast => (
                        <div key={toast.id} className="pointer-events-auto flex items-center gap-3 px-5 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-xl text-sm font-semibold text-slate-700 animate-slide-in-right min-w-[280px] max-w-[400px]">
                            <i className={`text-xs ${toast.type === 'success' ? 'fa-solid fa-check-circle text-green-500' : toast.type === 'error' ? 'fa-solid fa-exclamation-circle text-red-500' : 'fa-solid fa-info-circle text-blue-500'}`}></i>
                            <span className="flex-1">{toast.message}</span>
                            {toast.undoAction && (
                                <button onClick={() => { toast.undoAction(); dismissToast(toast.id); }} className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider shrink-0 px-2 py-1 hover:bg-blue-50 rounded-lg transition-all">Undo</button>
                            )}
                            <button onClick={() => dismissToast(toast.id)} className="text-slate-300 hover:text-slate-500 transition-colors ml-1"><LucideIcon name="x" className="text-xs" /></button>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
}
// Initial Render
try {
    const rootElement = document.getElementById('root');
    if (rootElement) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(<App />);
    }
} catch (e) {
    console.error("Failed to render App:", e);
}
