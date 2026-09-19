import React, { useState, useEffect } from 'react';
import {
  LifeboxItem,
  Collection,
  UserProfile,
  ViewTab,
  NotificationItem,
} from './types';
import { StorageService } from './services/storage';
import { AiService } from './services/ai';
import { ApiService } from './services/api';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { TodayDashboard } from './components/TodayDashboard';
import { ItemGrid } from './components/ItemGrid';
import { CameraScanner } from './components/CameraScanner';
import { ScanView } from './components/ScanView';
import { ScanHistoryView } from './components/ScanHistoryView';
import { StudentHub } from './components/StudentHub';
import { CollectionsView } from './components/CollectionsView';
import { RemindersView } from './components/RemindersView';
import { KnowledgeGraphView } from './components/KnowledgeGraphView';
import { TrashView } from './components/TrashView';
import { SettingsView } from './components/SettingsView';
import { QuickAddModal } from './components/QuickAddModal';
import { ItemDetailModal } from './components/ItemDetailModal';
import { OmniSearchModal } from './components/OmniSearchModal';
import { AskStuffDrawer } from './components/AskStuffDrawer';
import { PinPromptModal } from './components/PinPromptModal';
import { AiAgentView } from './components/AiAgentView';
import { NotesView } from './components/NotesView';
import { DocumentsView } from './components/DocumentsView';
import { PhotosView } from './components/PhotosView';
import { VoiceView } from './components/VoiceView';
import { TasksView } from './components/TasksView';
import { SmartPlansView } from './components/SmartPlansView';
import { CalendarView } from './components/CalendarView';
import { SecurityCenterView } from './components/SecurityCenterView';
import { ProfileView } from './components/ProfileView';
import { AuthModal } from './components/AuthModal';
import { NotificationCenter } from './components/NotificationCenter';
import {
  Sun,
  Inbox,
  Camera,
  GraduationCap,
  Sparkles,
  Plus,
} from 'lucide-react';

export default function App() {
  const [items, setItems] = useState<LifeboxItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [profile, setProfile] = useState<UserProfile>(StorageService.getProfile());
  const [activeTab, setActiveTab] = useState<ViewTab>('today');

  // Modals & Drawers
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAskStuffOpen, setIsAskStuffOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [askStuffInitialQuery, setAskStuffInitialQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<LifeboxItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLiveScannerOpen, setIsLiveScannerOpen] = useState(false);

  // Security & PIN
  const [isUnlocked, setIsUnlocked] = useState(!profile.isPinProtected);
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [browserPermissionStatus, setBrowserPermissionStatus] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Load items and collections on mount
  useEffect(() => {
    const loadedItems = StorageService.getItems();
    const loadedCollections = StorageService.getCollections();
    const loadedProfile = StorageService.getProfile();
    setItems(loadedItems);
    setCollections(loadedCollections);
    setProfile(loadedProfile);
    if (!loadedProfile.isPinProtected) {
      setIsUnlocked(true);
    }

    // Sync with backend session and data
    ApiService.initSession()
      .then(async () => {
        const [serverItems, serverCollections] = await Promise.all([
          ApiService.getItems(),
          ApiService.getCollections(),
        ]);
        if (serverItems && serverItems.length > 0) {
          setItems(serverItems);
          StorageService.saveItems(serverItems);
        }
        if (serverCollections && serverCollections.length > 0) {
          setCollections(serverCollections);
          StorageService.saveCollections(serverCollections);
        }
      })
      .catch((err) => {
        console.warn('Working in offline/local storage mode:', err);
      });
  }, []);

  // Global keyboard shortcuts (Cmd+K / Ctrl+K for Super Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Item operations
  const handleSaveNewItem = (item: LifeboxItem) => {
    const next = [item, ...items];
    setItems(next);
    StorageService.saveItems(next);
    ApiService.saveItem(item).catch((err) => console.warn('Server sync failed:', err));
  };

  const handleUpdateItem = (updated: LifeboxItem) => {
    const next = items.map((it) => (it.id === updated.id ? updated : it));
    setItems(next);
    StorageService.saveItems(next);
    if (selectedItem?.id === updated.id) {
      setSelectedItem(updated);
    }
    ApiService.saveItem(updated).catch((err) => console.warn('Server sync failed:', err));
  };

  const handleDeleteItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = items.map((it) => (it.id === id ? { ...it, isTrash: true, updatedAt: new Date().toISOString() } : it));
    setItems(next);
    StorageService.saveItems(next);
    if (selectedItem?.id === id) {
      setIsDetailOpen(false);
      setSelectedItem(null);
    }
    ApiService.deleteItem(id).catch((err) => console.warn('Server sync failed:', err));
  };

  const handleRestoreItem = (id: string) => {
    const next = items.map((it) => (it.id === id ? { ...it, isTrash: false, updatedAt: new Date().toISOString() } : it));
    setItems(next);
    StorageService.saveItems(next);
    ApiService.restoreItem(id).catch((err) => console.warn('Server sync failed:', err));
  };

  const handlePermanentDeleteItem = (id: string) => {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    StorageService.saveItems(next);
    ApiService.deleteItem(id, true).catch((err) => console.warn('Server sync failed:', err));
  };

  const handleEmptyTrash = () => {
    const next = items.filter((it) => !it.isTrash);
    setItems(next);
    StorageService.saveItems(next);
    ApiService.emptyTrash().catch((err) => console.warn('Server sync failed:', err));
  };

  const handleDuplicateItem = (id: string) => {
    const original = items.find((i) => i.id === id);
    if (!original) return;
    const duplicated: LifeboxItem = {
      ...original,
      id: 'item-' + Date.now(),
      title: `${original.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    handleSaveNewItem(duplicated);
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = items.find((i) => i.id === id);
    if (target) {
      handleUpdateItem({ ...target, pinned: !target.pinned });
    }
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = items.find((i) => i.id === id);
    if (target) {
      handleUpdateItem({ ...target, favorite: !target.favorite });
    }
  };

  const handleToggleReminderDone = (item: LifeboxItem) => {
    if (!item.reminder) return;
    handleUpdateItem({
      ...item,
      reminder: {
        ...item.reminder,
        completed: !item.reminder.completed,
      },
    });
  };

  // Collections operations
  const handleCreateCollection = (name: string, description: string, color: string) => {
    const newCol: Collection = {
      id: 'col-' + Date.now(),
      name,
      description,
      color,
      createdAt: new Date().toISOString(),
    };
    const next = [...collections, newCol];
    setCollections(next);
    StorageService.saveCollections(next);
  };

  const handleDeleteCollection = (id: string) => {
    const next = collections.filter((c) => c.id !== id);
    setCollections(next);
    StorageService.saveCollections(next);
  };

  // AI Auto Organize Everything
  const handleAutoOrganize = async () => {
    const result = await AiService.autoOrganize(items);
    if (result.categories && result.categories.length > 0) {
      const colors = ['#4f46e5', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6'];
      const newCols: Collection[] = result.categories.map((c, idx) => ({
        id: 'col-ai-' + Date.now() + '-' + idx,
        name: c.name,
        description: c.rationale || 'AI Smart Collection',
        color: colors[idx % colors.length],
        createdAt: new Date().toISOString(),
      }));

      // Map items to new collections
      const updatedItems = items.map((it) => {
        const found = result.categories.find((c) => c.itemIds.includes(it.id));
        if (found) {
          const col = newCols.find((nc) => nc.name === found.name);
          if (col && !it.collectionIds.includes(col.id)) {
            return { ...it, collectionIds: [...it.collectionIds, col.id] };
          }
        }
        return it;
      });

      const mergedCollections = [...collections, ...newCols];
      setCollections(mergedCollections);
      setItems(updatedItems);
      StorageService.saveCollections(mergedCollections);
      StorageService.saveItems(updatedItems);
    }
  };

  // Profile operations
  const handleUpdateProfile = (newProfile: UserProfile) => {
    setProfile(newProfile);
    StorageService.saveProfile(newProfile);
    if (!newProfile.isPinProtected) {
      setIsUnlocked(true);
    }
  };

  const handleResetToDemo = () => {
    if (confirm('Reset LIFEBOX to initial demo data? This resets items, notes, and collections.')) {
      StorageService.resetToDemo();
      setItems(StorageService.getItems());
      setCollections(StorageService.getCollections());
      setProfile(StorageService.getProfile());
    }
  };

  // Selection & Detail with PIN check and server-side vault decryption
  const handleSelectItem = (item: LifeboxItem) => {
    if (item.locked && !isUnlocked) {
      setPendingAction(() => async (pin?: string) => {
        let displayItem = item;
        if (pin) {
          try {
            displayItem = await ApiService.unlockVaultItem(item.id, pin);
          } catch (err) {
            console.warn('Vault decryption failed:', err);
          }
        }
        setSelectedItem(displayItem);
        setIsDetailOpen(true);
      });
      setIsPinPromptOpen(true);
    } else {
      setSelectedItem(item);
      setIsDetailOpen(true);
    }
  };

  const handleRequirePin = () => {
    setIsPinPromptOpen(true);
  };

  // Real-time reminder checker
  useEffect(() => {
    const checkReminders = () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const newNotifs: NotificationItem[] = [];

      items.forEach((it) => {
        if (it.isTrash) return;
        const due = it.dueDate || it.reminder?.dueDate;
        if (due && due <= todayStr) {
          if (!it.reminder?.completed && it.taskStatus !== 'completed') {
            newNotifs.push({
              id: `notif-${it.id}-${due}`,
              title: `Due Today: ${it.title}`,
              message: it.content ? it.content.slice(0, 80) : 'Item requires your attention today.',
              type: it.type === 'task' ? 'task' : 'reminder',
              timestamp: new Date().toISOString(),
              read: false,
              itemId: it.id,
              actionUrl: it.type,
            });
          }
        }
      });

      if (newNotifs.length > 0) {
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const additions = newNotifs.filter((n) => !existingIds.has(n.id));
          if (additions.length > 0 && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            additions.forEach((n) => {
              try {
                new Notification(n.title, { body: n.message });
              } catch (e) {
                // ignore
              }
            });
          }
          return [...additions, ...prev];
        });
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [items]);

  const handleRequestBrowserPermissions = async () => {
    if (typeof Notification !== 'undefined') {
      const status = await Notification.requestPermission();
      setBrowserPermissionStatus(status);
    }
  };

  // Navigation counts
  const activeItems = items.filter((i) => !i.isTrash);
  const counts = {
    total: activeItems.length,
    notes: activeItems.filter((i) => i.type === 'note').length,
    documents: activeItems.filter((i) => i.type === 'document' || i.type === 'link').length,
    photos: activeItems.filter((i) => i.type === 'image').length,
    voice: activeItems.filter((i) => i.type === 'audio').length,
    tasks: activeItems.filter((i) => i.type === 'task' && i.taskStatus !== 'completed').length,
    reminders: activeItems.filter((i) => i.reminder && !i.reminder.completed).length,
    student: activeItems.filter((i) => i.category === 'study' || i.studentMeta).length,
    trash: items.filter((i) => i.isTrash).length,
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans selection:bg-black selection:text-white pb-16 md:pb-0">
      {/* Top Navbar */}
      <Navbar
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAskStuff={() => {
          setAskStuffInitialQuery('');
          setIsAskStuffOpen(true);
        }}
        onOpenSettings={() => setActiveTab('settings')}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        unreadNotificationsCount={notifications.filter((n) => !n.read).length}
        onOpenProfile={() => setActiveTab('profile')}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        profile={profile}
        isUnlocked={isUnlocked}
        onToggleLock={() => {
          if (isUnlocked) {
            setIsUnlocked(false);
          } else {
            setIsPinPromptOpen(true);
          }
        }}
        trashCount={counts.trash}
      />

      {/* Main Body Shell with Sidebar & Content View */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          currentTab={activeTab}
          onSelectTab={setActiveTab}
          counts={counts}
        />

        {/* Dynamic Main Workspace View */}
        <main className={`flex-1 ${activeTab === 'agent' ? 'p-0 max-w-none' : 'p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto'} w-full overflow-x-hidden`}>
          {activeTab === 'agent' && (
            <AiAgentView
              items={items}
              collections={collections}
              onAddItem={handleSaveNewItem}
              onUpdateItem={handleUpdateItem}
              onAddCollection={(col) => {
                const next = [...collections, col];
                setCollections(next);
                StorageService.saveCollections(next);
                ApiService.saveCollection(col).catch((err) => console.warn(err));
              }}
              onSelectItem={handleSelectItem}
              onOpenScanner={() => {
                setActiveTab('scanner');
                setIsLiveScannerOpen(true);
              }}
            />
          )}

          {activeTab === 'today' && (
            <TodayDashboard
              items={items}
              profile={profile}
              onSelectItem={handleSelectItem}
              onSelectTab={setActiveTab}
              onOpenQuickAdd={() => setIsQuickAddOpen(true)}
              onOpenAskStuff={() => setIsAskStuffOpen(true)}
              onToggleReminderDone={handleToggleReminderDone}
            />
          )}

          {activeTab === 'items' && (
            <ItemGrid
              items={items}
              isUnlocked={isUnlocked}
              onSelectItem={handleSelectItem}
              onTogglePin={handleTogglePin}
              onToggleFavorite={handleToggleFavorite}
              onDeleteItem={handleDeleteItem}
              onRequirePin={handleRequirePin}
              onOpenQuickAdd={() => setIsQuickAddOpen(true)}
              title="All Saved Items"
              initialTypeFilter="all"
            />
          )}

          {activeTab === 'notes' && (
            <NotesView
              items={items}
              collections={collections}
              onSaveItem={handleSaveNewItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onSelectItem={handleSelectItem}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsView
              items={items}
              collections={collections}
              onSaveItem={handleSaveNewItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onSelectItem={handleSelectItem}
            />
          )}

          {activeTab === 'photos' && (
            <PhotosView
              items={items}
              collections={collections}
              onSaveItem={handleSaveNewItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onSelectItem={handleSelectItem}
            />
          )}

          {activeTab === 'voice' && (
            <VoiceView
              items={items}
              collections={collections}
              onSaveItem={handleSaveNewItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onSelectItem={handleSelectItem}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksView
              items={items}
              collections={collections}
              onSaveItem={handleSaveNewItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onSelectItem={handleSelectItem}
            />
          )}

          {activeTab === 'plans' && (
            <SmartPlansView
              items={items}
              collections={collections}
              onSaveItem={handleSaveNewItem}
              onSelectItem={handleSelectItem}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              items={items}
              collections={collections}
              onSaveItem={handleSaveNewItem}
              onSelectItem={handleSelectItem}
            />
          )}

          {activeTab === 'scanner' && (
            isLiveScannerOpen ? (
              <ScanView
                onClose={() => setIsLiveScannerOpen(false)}
                userToken={ApiService.getToken()}
                onScanComplete={() => {
                  setIsLiveScannerOpen(false);
                  ApiService.getItems().then((serverItems) => {
                    if (serverItems && serverItems.length > 0) {
                      setItems(serverItems);
                      StorageService.saveItems(serverItems);
                    }
                  });
                }}
              />
            ) : (
              <ScanHistoryView
                onScanNew={() => setIsLiveScannerOpen(true)}
                userToken={ApiService.getToken()}
              />
            )
          )}

          {activeTab === 'student' && (
            <StudentHub
              items={items}
              onSelectItem={handleSelectItem}
              onUpdateItem={handleUpdateItem}
              onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            />
          )}

          {activeTab === 'collections' && (
            <CollectionsView
              collections={collections}
              items={items}
              isUnlocked={isUnlocked}
              onSelectItem={handleSelectItem}
              onTogglePin={handleTogglePin}
              onToggleFavorite={handleToggleFavorite}
              onDeleteItem={handleDeleteItem}
              onRequirePin={handleRequirePin}
              onCreateCollection={handleCreateCollection}
              onDeleteCollection={handleDeleteCollection}
              onAutoOrganize={handleAutoOrganize}
            />
          )}

          {activeTab === 'reminders' && (
            <RemindersView
              items={items}
              onSelectItem={handleSelectItem}
              onUpdateItem={handleUpdateItem}
              onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            />
          )}

          {activeTab === 'graph' && (
            <KnowledgeGraphView
              items={items}
              onSelectItem={handleSelectItem}
            />
          )}

          {activeTab === 'trash' && (
            <TrashView
              items={items}
              onRestoreItem={handleRestoreItem}
              onPermanentDeleteItem={handlePermanentDeleteItem}
              onEmptyTrash={handleEmptyTrash}
            />
          )}

          {activeTab === 'security' && (
            <SecurityCenterView
              profile={profile}
              isUnlocked={isUnlocked}
              items={items}
              onUpdateProfile={handleUpdateProfile}
              onRequirePin={handleRequirePin}
              onSignOut={() => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              profile={profile}
              onUpdateProfile={handleUpdateProfile}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onSignOut={() => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              profile={profile}
              onUpdateProfile={handleUpdateProfile}
              items={items}
              onResetToDemo={handleResetToDemo}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-neutral-200 py-2 px-3 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('today')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            activeTab === 'today' ? 'text-black' : 'text-neutral-500'
          }`}
        >
          <Sun className="w-5 h-5" />
          <span>Today</span>
        </button>

        <button
          onClick={() => setActiveTab('items')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            activeTab === 'items' ? 'text-black' : 'text-neutral-500'
          }`}
        >
          <Inbox className="w-5 h-5" />
          <span>Items</span>
        </button>

        <button
          onClick={() => setIsQuickAddOpen(true)}
          className="flex flex-col items-center justify-center -mt-5 w-12 h-12 rounded-full bg-black text-white shadow-md active:scale-95 hover:bg-neutral-800"
        >
          <Plus className="w-6 h-6" />
        </button>

        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            activeTab === 'scanner' ? 'text-black' : 'text-neutral-500'
          }`}
        >
          <Camera className="w-5 h-5" />
          <span>Scan</span>
        </button>

        <button
          onClick={() => setIsAskStuffOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] font-bold text-neutral-800 hover:text-black"
        >
          <Sparkles className="w-5 h-5" />
          <span>Ask AI</span>
        </button>
      </div>

      {/* Modals & Drawers */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSaveItem={handleSaveNewItem}
        collections={collections}
      />

      <ItemDetailModal
        item={selectedItem}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedItem(null);
        }}
        onUpdateItem={handleUpdateItem}
        onDeleteItem={handleDeleteItem}
        onDuplicateItem={handleDuplicateItem}
        isUnlocked={isUnlocked}
        onRequirePin={handleRequirePin}
      />

      <OmniSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        items={items}
        onSelectItem={handleSelectItem}
        onSwitchToAskStuff={(q) => {
          setAskStuffInitialQuery(q);
          setIsAskStuffOpen(true);
        }}
      />

      <AskStuffDrawer
        isOpen={isAskStuffOpen}
        onClose={() => setIsAskStuffOpen(false)}
        items={items}
        onSelectItem={handleSelectItem}
        initialQuery={askStuffInitialQuery}
      />

      <PinPromptModal
        isOpen={isPinPromptOpen}
        onClose={() => {
          setIsPinPromptOpen(false);
          setPendingAction(null);
        }}
        onSuccess={(enteredPin) => {
          setIsUnlocked(true);
          if (pendingAction) {
            (pendingAction as any)(enteredPin);
            setPendingAction(null);
          }
        }}
      />

      {/* Notification Center Drawer */}
      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }}
        onSelectNotification={(notif) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
          );
          if (notif.itemId) {
            const target = items.find((i) => i.id === notif.itemId);
            if (target) {
              handleSelectItem(target);
            }
          }
        }}
        onRequestBrowserPermissions={handleRequestBrowserPermissions}
        browserPermissionStatus={browserPermissionStatus}
      />

      {/* Authentication & User Switching Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={async () => {
          setIsAuthModalOpen(false);
          try {
            const sess = await ApiService.initSession();
            if (sess?.user) {
              const updatedProfile: UserProfile = {
                username: sess.user.username,
                email: sess.user.email,
                avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
                isPinProtected: false,
                language: 'English (US)',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              };
              setProfile(updatedProfile);
              StorageService.saveProfile(updatedProfile);
            }
            const [serverItems, serverCollections] = await Promise.all([
              ApiService.getItems(),
              ApiService.getCollections(),
            ]);
            if (serverItems) {
              setItems(serverItems);
              StorageService.saveItems(serverItems);
            }
            if (serverCollections) {
              setCollections(serverCollections);
              StorageService.saveCollections(serverCollections);
            }
          } catch (e) {
            console.warn('Auth refresh error:', e);
          }
        }}
      />
    </div>
  );
}
