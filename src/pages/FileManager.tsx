import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Folder,
  FolderPlus,
  FilePlus,
  FileText,
  Trash2,
  Search,
  Star,
  Share2,
  Download,
  Upload,
  MoreVertical,
  ChevronRight,
  Info,
  X,
  Eye,
  Plus,
  Edit3,
  Filter,
  FolderOpen,
  FileCode,
  FileImage,
  Tag,
  Grid,
  List,
  ArrowLeft,
  Save,
  RefreshCw,
  Check,
  Archive,
  CheckSquare,
  Square,
  AlertCircle,
  HelpCircle,
  FileBox,
  HardDrive,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/src/lib/AuthContext";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";

// Firestore sanitization helper to remove undefined fields recursively
function sanitizeForFirestore<T extends object>(obj: T): any {
  if (obj === null || obj === undefined) return null;
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        result[key] = sanitizeForFirestore(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

// Types
interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
  isStarred?: boolean;
  tags?: string[];
}

interface FileItem {
  id: string;
  name: string;
  folderId: string | null;
  size: number; // in bytes
  type: string; // mime or category
  content?: string; // plain text files
  imageBlob?: string; // loaded base64 images
  createdAt: number;
  updatedAt: number;
  isStarred?: boolean;
  isTrash?: boolean;
  trashAt?: number;
  tags?: string[];
}

interface TagDefinition {
  label: string;
  color: string; // Tailwind bg-class
  border: string; // Tailwind border-class
  text: string; // Tailwind text-class
}

const AVAILABLE_TAGS: TagDefinition[] = [
  {
    label: "High Priority",
    color: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
  },
  {
    label: "Work",
    color: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
  },
  {
    label: "Personal",
    color: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },
  {
    label: "Drafts",
    color: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  {
    label: "Invoices",
    color: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-700",
  },
];

export default function FileManager() {
  // Navigation & View State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeSidebar, setActiveSidebar] = useState<
    "all" | "starred" | "trash"
  >("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Selection
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null); // Details panel side drawer
  const [focusedItemType, setFocusedItemType] = useState<
    "file" | "folder" | null
  >(null);

  // Core Data State
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);

  // Modals state
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isNewTextFileOpen, setIsNewTextFileOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

  // Modal Fields
  const [newFolderName, setNewFolderName] = useState("");
  const [newFileName, setNewFileName] = useState("untitled.txt");
  const [newFileContent, setNewFileContent] = useState("");
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    type: "file" | "folder";
    name: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveTarget, setMoveTarget] = useState<{
    ids: string[];
    type: "bulk" | "single";
  } | null>(null);
  const [moveDestinationId, setMoveDestinationId] = useState<string | null>(
    null,
  );

  // File Preview Modal
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editBuffer, setEditBuffer] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user, login } = useAuth();
  const [loadingDb, setLoadingDb] = useState(false);

  const seedFirebaseData = async (uid: string) => {
    try {
      const batch = writeBatch(db);
      const initialFolders: FolderItem[] = [
        {
          id: `${uid}-f-1`,
          name: "AI Templates",
          parentId: null,
          createdAt: Date.now() - 50000000,
          updatedAt: Date.now() - 50000000,
          isStarred: true,
          tags: ["Work"],
        },
        {
          id: `${uid}-f-2`,
          name: "Design Assets",
          parentId: null,
          createdAt: Date.now() - 40000000,
          updatedAt: Date.now() - 40000000,
          tags: ["Drafts"],
        },
        {
          id: `${uid}-f-3`,
          name: "Submissions",
          parentId: `${uid}-f-1`,
          createdAt: Date.now() - 20000000,
          updatedAt: Date.now() - 20000000,
          tags: ["Personal"],
        },
        {
          id: `${uid}-f-4`,
          name: "Legal Documentations",
          parentId: null,
          createdAt: Date.now() - 100000000,
          updatedAt: Date.now() - 90000000,
          tags: [],
        },
      ];

      const initialFiles: FileItem[] = [
        {
          id: `${uid}-fl-1`,
          name: "ai-copilot-prompt.md",
          folderId: `${uid}-f-1`,
          size: 1420,
          type: "text/markdown",
          content: `# Global Engineering Copilot Directive\n\nThis markdown is used to orient server models with specific systems capabilities.\n\n## Capabilities\n- System code refactoring\n- Live compiling assertions\n- Standard vector assets pipeline\n\nCreated during baseline analysis phase.`,
          createdAt: Date.now() - 45000000,
          updatedAt: Date.now() - 30000000,
          isStarred: true,
          tags: ["High Priority", "Work"],
        },
        {
          id: `${uid}-fl-2`,
          name: "prism-logo-guide.txt",
          folderId: `${uid}-f-2`,
          size: 615,
          type: "text/plain",
          content: `AI STUDIO LOGO STYLE GUIDE\n==========================\n\n- Primary Font Pairings: Space Grotesk + JetBrains Mono\n- Standard Anchor Hex: #4338ca (Indigo 700)\n- Core Theme: Cosmic Slate Theme with High-Contrast\n- Sub-theme Highlights: Pink #ec4899 with modern 3D offsets\n`,
          createdAt: Date.now() - 35000000,
          updatedAt: Date.now() - 35000000,
          tags: ["Work", "Drafts"],
        },
        {
          id: `${uid}-fl-3`,
          name: "Q4_Revenue_Projection.csv",
          folderId: null,
          size: 8900,
          type: "text/csv",
          content:
            "Quarter,Services Revenue,Subscription Revenue,Operational Expense,Direct Margin\nQ1,55000,42000,12000,91%\nQ2,68000,48000,14000,90%\nQ3,79000,53000,15500,92%\nQ4,115000,75000,21000,93%\n",
          createdAt: Date.now() - 12000000,
          updatedAt: Date.now() - 12000000,
          tags: ["Invoices"],
        },
        {
          id: `${uid}-fl-4`,
          name: "NDA_Enterprise_Template.pdf",
          folderId: `${uid}-f-4`,
          size: 245000,
          type: "application/pdf",
          createdAt: Date.now() - 85000000,
          updatedAt: Date.now() - 85000000,
          isStarred: true,
          tags: [],
        },
      ];

      for (const folder of initialFolders) {
        await setDoc(doc(db, "folders", folder.id), {
          ...folder,
          userId: uid,
        });
      }

      for (const file of initialFiles) {
        await setDoc(doc(db, "files", file.id), {
          ...file,
          userId: uid,
        });
      }
      toast.success("Default templates synchronized to your cloud!");
    } catch (e) {
      console.error("Firestore seeding failed:", e);
    }
  };

  // Initialize data and hook Up Live Firebase Listener
  useEffect(() => {
    if (!user) {
      const savedFolders = localStorage.getItem("studio_folders");
      const savedFiles = localStorage.getItem("studio_files");

      if (savedFolders && savedFiles) {
        setFolders(JSON.parse(savedFolders));
        setFiles(JSON.parse(savedFiles));
      } else {
        const initialFolders: FolderItem[] = [
          {
            id: "f-1",
            name: "AI Templates",
            parentId: null,
            createdAt: Date.now() - 50000000,
            updatedAt: Date.now() - 50000000,
            isStarred: true,
            tags: ["Work"],
          },
          {
            id: "f-2",
            name: "Design Assets",
            parentId: null,
            createdAt: Date.now() - 40000000,
            updatedAt: Date.now() - 40000000,
            tags: ["Drafts"],
          },
          {
            id: "f-3",
            name: "Submissions",
            parentId: "f-1",
            createdAt: Date.now() - 20000000,
            updatedAt: Date.now() - 20000000,
            tags: ["Personal"],
          },
          {
            id: "f-4",
            name: "Legal Documentations",
            parentId: null,
            createdAt: Date.now() - 100000000,
            updatedAt: Date.now() - 90000000,
          },
        ];

        const initialFiles: FileItem[] = [
          {
            id: "fl-1",
            name: "ai-copilot-prompt.md",
            folderId: "f-1",
            size: 1420,
            type: "text/markdown",
            content: `# Global Engineering Copilot Directive\n\nThis markdown is used to orient server models with specific systems capabilities.\n\n## Capabilities\n- System code refactoring\n- Live compiling assertions\n- Standard vector assets pipeline\n\nCreated during baseline analysis phase.`,
            createdAt: Date.now() - 45000000,
            updatedAt: Date.now() - 30000000,
            isStarred: true,
            tags: ["High Priority", "Work"],
          },
          {
            id: "fl-2",
            name: "prism-logo-guide.txt",
            folderId: "f-2",
            size: 615,
            type: "text/plain",
            content: `AI STUDIO LOGO STYLE GUIDE\n==========================\n\n- Primary Font Pairings: Space Grotesk + JetBrains Mono\n- Standard Anchor Hex: #4338ca (Indigo 700)\n- Core Theme: Cosmic Slate Theme with High-Contrast\n- Sub-theme Highlights: Pink #ec4899 with modern 3D offsets\n`,
            createdAt: Date.now() - 35000000,
            updatedAt: Date.now() - 35000000,
            tags: ["Work", "Drafts"],
          },
          {
            id: "fl-3",
            name: "Q4_Revenue_Projection.csv",
            folderId: null,
            size: 8900,
            type: "text/csv",
            content:
              "Quarter,Services Revenue,Subscription Revenue,Operational Expense,Direct Margin\nQ1,55000,42000,12000,91%\nQ2,68000,48000,14000,90%\nQ3,79000,53000,15500,92%\nQ4,115000,75000,21000,93%\n",
            createdAt: Date.now() - 12000000,
            updatedAt: Date.now() - 12000000,
            tags: ["Invoices"],
          },
          {
            id: "fl-4",
            name: "NDA_Enterprise_Template.pdf",
            folderId: "f-4",
            size: 245000,
            type: "application/pdf",
            createdAt: Date.now() - 85000000,
            updatedAt: Date.now() - 85000000,
            isStarred: true,
          },
        ];

        setFolders(initialFolders);
        setFiles(initialFiles);
        localStorage.setItem("studio_folders", JSON.stringify(initialFolders));
        localStorage.setItem("studio_files", JSON.stringify(initialFiles));
      }
      return;
    }

    setLoadingDb(true);
    let foldersLoaded = false;
    let filesLoaded = false;
    let foldersList: FolderItem[] = [];
    let filesList: FileItem[] = [];

    const handleInitialSeeding = async (
      fList: FolderItem[],
      fFiles: FileItem[],
    ) => {
      if (foldersLoaded && filesLoaded) {
        if (fList.length === 0 && fFiles.length === 0) {
          await seedFirebaseData(user.uid);
        }
        setLoadingDb(false);
      }
    };

    const foldersQuery = query(
      collection(db, "folders"),
      where("userId", "==", user.uid),
    );
    const unsubscribeFolders = onSnapshot(
      foldersQuery,
      (snapshot) => {
        const dbFolders: FolderItem[] = [];
        snapshot.forEach((doc) => {
          dbFolders.push({ id: doc.id, ...doc.data() } as FolderItem);
        });
        setFolders(dbFolders);
        foldersList = dbFolders;
        foldersLoaded = true;
        handleInitialSeeding(foldersList, filesList);
      },
      (error) => {
        console.error("Folders Live Sync Error:", error);
        setLoadingDb(false);
      },
    );

    const filesQuery = query(
      collection(db, "files"),
      where("userId", "==", user.uid),
    );
    const unsubscribeFiles = onSnapshot(
      filesQuery,
      (snapshot) => {
        const dbFiles: FileItem[] = [];
        snapshot.forEach((doc) => {
          dbFiles.push({ id: doc.id, ...doc.data() } as FileItem);
        });
        setFiles(dbFiles);
        filesList = dbFiles;
        filesLoaded = true;
        handleInitialSeeding(foldersList, filesList);
      },
      (error) => {
        console.error("Files Live Sync Error:", error);
        setLoadingDb(false);
      },
    );

    return () => {
      unsubscribeFolders();
      unsubscribeFiles();
    };
  }, [user]);

  // Save changes locally or state sync
  const syncToDisk = (
    updatedFolders: FolderItem[],
    updatedFiles: FileItem[],
  ) => {
    localStorage.setItem("studio_folders", JSON.stringify(updatedFolders));
    localStorage.setItem("studio_files", JSON.stringify(updatedFiles));
    setFolders(updatedFolders);
    setFiles(updatedFiles);
  };

  // Helper selectors
  const rootFolders = folders.filter((f) => f.parentId === currentFolderId);
  const currentFiles = files.filter(
    (f) => f.folderId === currentFolderId && !f.isTrash,
  );
  const trashedFiles = files.filter((f) => f.isTrash);

  // Filter display list based on active sidebar and query
  const getFilteredItems = () => {
    let baseFiles = [...files];

    if (activeSidebar === "trash") {
      baseFiles = baseFiles.filter((f) => f.isTrash);
    } else {
      baseFiles = baseFiles.filter((f) => !f.isTrash);

      // Starred filter
      if (activeSidebar === "starred") {
        baseFiles = baseFiles.filter((f) => f.isStarred);
      } else {
        // We are viewing folder-specific items in "all" page
        baseFiles = baseFiles.filter((f) => f.folderId === currentFolderId);
      }

      // Tag filter
      if (selectedTag) {
        baseFiles = baseFiles.filter((f) => f.tags?.includes(selectedTag));
      }
    }

    // Search query query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      baseFiles = baseFiles.filter(
        (f) =>
          f.name.toLowerCase().includes(query) ||
          f.content?.toLowerCase().includes(query) ||
          f.tags?.some((t) => t.toLowerCase().includes(query)),
      );
    }

    return baseFiles;
  };

  const getFilteredFolders = () => {
    if (activeSidebar === "trash") return [];

    let baseFolders = [...folders];

    if (activeSidebar === "starred") {
      baseFolders = baseFolders.filter((f) => f.isStarred);
    } else {
      baseFolders = baseFolders.filter((f) => f.parentId === currentFolderId);
    }

    if (selectedTag) {
      baseFolders = baseFolders.filter((f) => f.tags?.includes(selectedTag));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      baseFolders = baseFolders.filter((f) =>
        f.name.toLowerCase().includes(query),
      );
    }

    return baseFolders;
  };

  const currentPath = () => {
    const path: FolderItem[] = [];
    let currentId = currentFolderId;
    while (currentId) {
      const folder = folders.find((f) => f.id === currentId);
      if (folder) {
        path.unshift(folder);
        currentId = folder.parentId;
      } else {
        break;
      }
    }
    return path;
  };

  // Actions
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Please provide a valid folder name");
      return;
    }

    const newFolder: FolderItem = {
      id: `f-${Date.now()}`,
      name: newFolderName.trim(),
      parentId: currentFolderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isStarred: false,
      tags: [],
    };

    try {
      if (user) {
        await setDoc(doc(db, "folders", newFolder.id), {
          ...newFolder,
          userId: user.uid,
        });
      } else {
        const nextFolders = [...folders, newFolder];
        syncToDisk(nextFolders, files);
      }
      setNewFolderName("");
      setIsNewFolderOpen(false);
      toast.success("Folder created successfully");
    } catch (err) {
      toast.error("Cloud synchronization failed");
      console.error(err);
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      toast.error("Please provide a filename");
      return;
    }

    // Ensure extension
    let finalName = newFileName.trim();
    if (!finalName.includes(".")) {
      finalName += ".txt";
    }

    const newFile: FileItem = {
      id: `fl-${Date.now()}`,
      name: finalName,
      folderId: currentFolderId,
      size: new Blob([newFileContent]).size,
      type: finalName.endsWith(".md") ? "text/markdown" : "text/plain",
      content: newFileContent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
    };

    try {
      if (user) {
        await setDoc(doc(db, "files", newFile.id), {
          ...newFile,
          userId: user.uid,
        });
      } else {
        const nextFiles = [...files, newFile];
        syncToDisk(folders, nextFiles);
      }
      setNewFileName("untitled.txt");
      setNewFileContent("");
      setIsNewTextFileOpen(false);
      toast.success("Text file created");
    } catch (err) {
      toast.error("Cloud synchronization failed");
      console.error(err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    Array.from(uploadedFiles).forEach((file) => {
      const reader = new FileReader();
      const isText =
        file.type.startsWith("text/") ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".json") ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".js") ||
        file.name.endsWith(".ts");
      const isImage = file.type.startsWith("image/");

      reader.onload = async (loadEvent) => {
        const result = loadEvent.target?.result as string;

        const freshFile: FileItem = {
          id: `fl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: file.name,
          folderId: currentFolderId,
          size: file.size,
          type: file.type || "application/octet-stream",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: [],
        };

        if (isText) {
          freshFile.content = result;
        }
        if (isImage) {
          freshFile.imageBlob = result;
        }

        try {
          if (user) {
            await setDoc(doc(db, "files", freshFile.id), {
              ...freshFile,
              userId: user.uid,
            });
          } else {
            setFiles((prev) => {
              const next = [...prev, freshFile];
              localStorage.setItem("studio_files", JSON.stringify(next));
              return next;
            });
          }
        } catch (err) {
          toast.error("Failed to sync upload: " + file.name);
          console.error(err);
        }
      };

      if (isText) {
        reader.readAsText(file);
      } else if (isImage) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });

    toast.success(`Processing and uploading ${uploadedFiles.length} file(s)`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRename = async () => {
    if (!renameValue.trim() || !renameTarget) return;

    try {
      if (renameTarget.type === "file") {
        if (user) {
          const fileObj = files.find((f) => f.id === renameTarget.id);
          if (fileObj) {
            await setDoc(
              doc(db, "files", renameTarget.id),
              sanitizeForFirestore({
                ...fileObj,
                name: renameValue.trim(),
                updatedAt: Date.now(),
              }),
              { merge: true },
            );
          }
        } else {
          const nextFiles = files.map((f) => {
            if (f.id === renameTarget.id) {
              return { ...f, name: renameValue.trim(), updatedAt: Date.now() };
            }
            return f;
          });
          syncToDisk(folders, nextFiles);
        }
        // Update focused node if changed
        if (focusedItemId === renameTarget.id) {
          setFocusedItemId(null);
        }
      } else {
        if (user) {
          const folderObj = folders.find((f) => f.id === renameTarget.id);
          if (folderObj) {
            await setDoc(
              doc(db, "folders", renameTarget.id),
              sanitizeForFirestore({
                ...folderObj,
                name: renameValue.trim(),
                updatedAt: Date.now(),
              }),
              { merge: true },
            );
          }
        } else {
          const nextFolders = folders.map((f) => {
            if (f.id === renameTarget.id) {
              return { ...f, name: renameValue.trim(), updatedAt: Date.now() };
            }
            return f;
          });
          syncToDisk(nextFolders, files);
        }
      }

      setRenameTarget(null);
      setRenameValue("");
      setIsRenameModalOpen(false);
      toast.success("Name updated");
    } catch (err) {
      toast.error("Rename failed to sync");
      console.error(err);
    }
  };

  const handleMoveSelection = async () => {
    if (!moveTarget) return;

    try {
      if (moveTarget.type === "bulk") {
        if (user) {
          const batch = writeBatch(db);
          moveTarget.ids.forEach((id) => {
            const fileObj = files.find((f) => f.id === id);
            if (fileObj) {
              const fileRef = doc(db, "files", id);
              batch.set(
                fileRef,
                sanitizeForFirestore({
                  ...fileObj,
                  folderId: moveDestinationId,
                  updatedAt: Date.now(),
                }),
                { merge: true },
              );
            } else {
              const folderObj = folders.find((f) => f.id === id);
              if (folderObj) {
                const folderRef = doc(db, "folders", id);
                batch.set(
                  folderRef,
                  sanitizeForFirestore({
                    ...folderObj,
                    parentId: moveDestinationId,
                    updatedAt: Date.now(),
                  }),
                  { merge: true },
                );
              }
            }
          });
          await batch.commit();
        } else {
          const nextFiles = files.map((f) => {
            if (moveTarget.ids.includes(f.id)) {
              return {
                ...f,
                folderId: moveDestinationId,
                updatedAt: Date.now(),
              };
            }
            return f;
          });
          const nextFolders = folders.map((f) => {
            if (moveTarget.ids.includes(f.id)) {
              return {
                ...f,
                parentId: moveDestinationId,
                updatedAt: Date.now(),
              };
            }
            return f;
          });
          syncToDisk(nextFolders, nextFiles);
        }
        setSelectedItemIds([]);
      } else {
        const singleId = moveTarget.ids[0];
        if (user) {
          const fileObj = files.find((f) => f.id === singleId);
          if (fileObj) {
            await setDoc(
              doc(db, "files", singleId),
              sanitizeForFirestore({
                ...fileObj,
                folderId: moveDestinationId,
                updatedAt: Date.now(),
              }),
              { merge: true },
            );
          } else {
            const folderObj = folders.find((f) => f.id === singleId);
            if (folderObj) {
              await setDoc(
                doc(db, "folders", singleId),
                sanitizeForFirestore({
                  ...folderObj,
                  parentId: moveDestinationId,
                  updatedAt: Date.now(),
                }),
                { merge: true },
              );
            }
          }
        } else {
          const nextFiles = files.map((f) => {
            if (f.id === singleId) {
              return {
                ...f,
                folderId: moveDestinationId,
                updatedAt: Date.now(),
              };
            }
            return f;
          });
          const nextFolders = folders.map((f) => {
            if (f.id === singleId) {
              return {
                ...f,
                parentId: moveDestinationId,
                updatedAt: Date.now(),
              };
            }
            return f;
          });
          syncToDisk(nextFolders, nextFiles);
        }
      }

      setMoveTarget(null);
      setMoveDestinationId(null);
      setIsMoveModalOpen(false);
      toast.success("Items moved successfully");
    } catch (err) {
      toast.error("Cloud action failed");
      console.error(err);
    }
  };

  const handleToggleStar = async (
    id: string,
    type: "file" | "folder",
    e?: React.MouseEvent,
  ) => {
    e?.stopPropagation();
    try {
      if (type === "file") {
        const fileObj = files.find((f) => f.id === id);
        if (fileObj) {
          const nextStarred = !fileObj.isStarred;
          if (user) {
            await setDoc(
              doc(db, "files", id),
              sanitizeForFirestore({
                ...fileObj,
                isStarred: nextStarred,
                updatedAt: Date.now(),
              }),
              { merge: true },
            );
          } else {
            const nextFiles = files.map((f) =>
              f.id === id ? { ...f, isStarred: nextStarred } : f,
            );
            syncToDisk(folders, nextFiles);
          }
        }
      } else {
        const folderObj = folders.find((f) => f.id === id);
        if (folderObj) {
          const nextStarred = !folderObj.isStarred;
          if (user) {
            await setDoc(
              doc(db, "folders", id),
              sanitizeForFirestore({
                ...folderObj,
                isStarred: nextStarred,
                updatedAt: Date.now(),
              }),
              { merge: true },
            );
          } else {
            const nextFolders = folders.map((f) =>
              f.id === id ? { ...f, isStarred: nextStarred } : f,
            );
            syncToDisk(nextFolders, files);
          }
        }
      }
      toast.success("Starred state toggled");
    } catch (err) {
      toast.error("Failed to toggle star");
      console.error(err);
    }
  };

  const handleSendToTrash = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const fileObj = files.find((f) => f.id === id);
      if (fileObj) {
        if (user) {
          await setDoc(
            doc(db, "files", id),
            sanitizeForFirestore({
              ...fileObj,
              isTrash: true,
              trashAt: Date.now(),
              updatedAt: Date.now(),
            }),
            { merge: true },
          );
        } else {
          const nextFiles = files.map((f) =>
            f.id === id ? { ...f, isTrash: true, trashAt: Date.now() } : f,
          );
          syncToDisk(folders, nextFiles);
        }
      }

      if (focusedItemId === id) {
        setFocusedItemId(null);
      }
      setSelectedItemIds((prev) => prev.filter((selected) => selected !== id));
      toast.success("Item sent to Recycle Bin");
    } catch (err) {
      toast.error("Failed to move item to bin");
      console.error(err);
    }
  };

  const handleRestoreFromTrash = async (id: string) => {
    try {
      const fileObj = files.find((f) => f.id === id);
      if (fileObj) {
        if (user) {
          await setDoc(
            doc(db, "files", id),
            sanitizeForFirestore({
              ...fileObj,
              isTrash: false,
              trashAt: null,
              updatedAt: Date.now(),
            }),
            { merge: true },
          );
        } else {
          const nextFiles = files.map((f) =>
            f.id === id ? { ...f, isTrash: false, trashAt: undefined } : f,
          );
          syncToDisk(folders, nextFiles);
        }
      }
      toast.success("Item restored back");
    } catch (err) {
      toast.error("Failed to restore item");
      console.error(err);
    }
  };

  const handleDeletePermanently = async (id: string) => {
    try {
      if (user) {
        await deleteDoc(doc(db, "files", id));
      } else {
        const nextFiles = files.filter((f) => f.id !== id);
        syncToDisk(folders, nextFiles);
      }

      if (focusedItemId === id) {
        setFocusedItemId(null);
      }
      toast.error("File permanently destroyed");
    } catch (err) {
      toast.error("Delete operation failed");
      console.error(err);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      const trashed = files.filter((f) => f.isTrash);
      if (user) {
        const batch = writeBatch(db);
        trashed.forEach((f) => {
          batch.delete(doc(db, "files", f.id));
        });
        await batch.commit();
      } else {
        const nextFiles = files.filter((f) => !f.isTrash);
        syncToDisk(folders, nextFiles);
      }
      setFocusedItemId(null);
      toast.success("Recycle Bin completely emptied");
    } catch (err) {
      toast.error("Failed to empty trash");
      console.error(err);
    }
  };

  // Bulk operations
  const toggleBulkSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedItemIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleBulkTrash = async () => {
    if (selectedItemIds.length === 0) return;
    try {
      if (user) {
        const batch = writeBatch(db);
        selectedItemIds.forEach((id) => {
          const fileObj = files.find((f) => f.id === id);
          if (fileObj) {
            batch.set(
              doc(db, "files", id),
              {
                ...fileObj,
                isTrash: true,
                trashAt: Date.now(),
                updatedAt: Date.now(),
              },
              { merge: true },
            );
          }
        });
        await batch.commit();
      } else {
        const nextFiles = files.map((f) =>
          selectedItemIds.includes(f.id)
            ? { ...f, isTrash: true, trashAt: Date.now() }
            : f,
        );
        syncToDisk(folders, nextFiles);
      }
      setSelectedItemIds([]);
      toast.success(`Sent ${selectedItemIds.length} files to Recycle Bin`);
    } catch (err) {
      toast.error("Bulk trash failed");
      console.error(err);
    }
  };

  const handleBulkStar = async (starState: boolean) => {
    if (selectedItemIds.length === 0) return;
    try {
      if (user) {
        const batch = writeBatch(db);
        selectedItemIds.forEach((id) => {
          const fileObj = files.find((f) => f.id === id);
          if (fileObj) {
            batch.set(
              doc(db, "files", id),
              {
                ...fileObj,
                isStarred: starState,
                updatedAt: Date.now(),
              },
              { merge: true },
            );
          }
        });
        await batch.commit();
      } else {
        const nextFiles = files.map((f) =>
          selectedItemIds.includes(f.id) ? { ...f, isStarred: starState } : f,
        );
        syncToDisk(folders, nextFiles);
      }
      toast.success(`Updated favorites flag on selected files`);
    } catch (err) {
      toast.error("Bulk star failed");
      console.error(err);
    }
  };

  const handleApplyTagsToSelected = async (tagName: string) => {
    if (selectedItemIds.length === 0) return;
    try {
      if (user) {
        const batch = writeBatch(db);
        selectedItemIds.forEach((id) => {
          const fileObj = files.find((f) => f.id === id);
          if (fileObj) {
            const currentTags = fileObj.tags || [];
            const nextTags = currentTags.includes(tagName)
              ? currentTags
              : [...currentTags, tagName];
            batch.set(
              doc(db, "files", id),
              {
                ...fileObj,
                tags: nextTags,
                updatedAt: Date.now(),
              },
              { merge: true },
            );
          }
        });
        await batch.commit();
      } else {
        const nextFiles = files.map((f) => {
          if (selectedItemIds.includes(f.id)) {
            const currentTags = f.tags || [];
            const nextTags = currentTags.includes(tagName)
              ? currentTags
              : [...currentTags, tagName];
            return { ...f, tags: nextTags };
          }
          return f;
        });
        syncToDisk(folders, nextFiles);
      }
      toast.success(`Applied tag "${tagName}" to selection`);
    } catch (err) {
      toast.error("Bulk tag application failed");
      console.error(err);
    }
  };

  // File previewer & editor save
  const handleSaveTextEdit = async () => {
    if (!previewFile) return;
    try {
      if (user) {
        const fileObj = files.find((f) => f.id === previewFile.id);
        if (fileObj) {
          await setDoc(
            doc(db, "files", previewFile.id),
            sanitizeForFirestore({
              ...fileObj,
              content: editBuffer,
              size: new Blob([editBuffer]).size,
              updatedAt: Date.now(),
            }),
            { merge: true },
          );
        }
      } else {
        const nextFiles = files.map((f) => {
          if (f.id === previewFile.id) {
            return {
              ...f,
              content: editBuffer,
              size: new Blob([editBuffer]).size,
              updatedAt: Date.now(),
            };
          }
          return f;
        });
        syncToDisk(folders, nextFiles);
      }
      setIsEditingContent(false);
      setPreviewFile((prev) =>
        prev ? { ...prev, content: editBuffer } : null,
      );
      toast.success("Changes saved successfully");
    } catch (err) {
      toast.error("Saving file content failed");
      console.error(err);
    }
  };

  // Format Helper for file sizes
  const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Mime Category Icon Selector
  const getFileIcon = (mimeOrType?: string, name?: string) => {
    const safeType = mimeOrType || "application/octet-stream";
    const safeName = name || "untitled.txt";
    const fileExt = safeName.split(".").pop()?.toLowerCase() || "";
    if (
      safeType.startsWith("image/") ||
      ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt)
    ) {
      return <FileImage className="text-emerald-500 w-5 h-5 md:w-6 md:h-6" />;
    }
    if (safeType.includes("pdf") || fileExt === "pdf") {
      return <FileText className="text-red-500 w-5 h-5 md:w-6 md:h-6" />;
    }
    if (safeType.includes("markdown") || ["md", "markdown"].includes(fileExt)) {
      return <FileCode className="text-indigo-500 w-5 h-5 md:w-6 md:h-6" />;
    }
    if (
      safeType.includes("json") ||
      safeType.includes("javascript") ||
      ["json", "js", "ts", "py", "html", "css"].includes(fileExt)
    ) {
      return <FileCode className="text-amber-500 w-5 h-5 md:w-6 md:h-6" />;
    }
    return <FileText className="text-slate-400 w-5 h-5 md:w-6 md:h-6" />;
  };

  // Disk size summation (out of 1MB simulation for demonstration or simple storage limit warning)
  const totalStorageUsed = files.reduce((acc, curr) => acc + curr.size, 0);
  const storageProgress = Math.min(
    (totalStorageUsed / (10 * 1024 * 1024)) * 100,
    100,
  ); // 10MB simulated bounds

  // Currently focused meta item
  const activeFocusItem =
    focusedItemType === "file"
      ? files.find((f) => f.id === focusedItemId)
      : folders.find((f) => f.id === focusedItemId);

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6 md:space-y-8 px-4 md:px-0">
      {/* Header bar / Title Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-main pb-4 md:pb-6">
        <div className="space-y-1">
          <h1 className="text-xl md:text-3xl font-bold tracking-tight text-slate-900">
            Advanced File Vault
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium tracking-wide flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-primary" /> Advanced virtual
            organization, live client storage, and file editor cockpit.
          </p>
        </div>

        {/* Global search input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search text, markdown, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 bg-white border border-slate-200 rounded-md pl-9 pr-4 py-2 text-sm text-slate-700 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              if (fileInputRef.current) fileInputRef.current.click();
            }}
            className="flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-primary-hover shadow-md shadow-indigo-50"
          >
            <Upload size={14} /> Upload Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Main split dashboard view */}
      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[240px_1fr]">
        {/* Column 1: Sidebar Filters & disk storage */}
        <div className="space-y-6">
          <div className="bg-white border border-border-main rounded-md p-4 space-y-4 shadow-sm">
            {/* Storage Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-widest text-[9px]">
                  Local Vault Occupancy
                </span>
                <span className="font-mono text-indigo-600 font-bold">
                  {formatBytes(totalStorageUsed)}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500`}
                  style={{ width: `${storageProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Virtual simulation using browser index database.
              </p>
            </div>

            <hr className="border-slate-100" />

            {/* Menu options */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  setActiveSidebar("all");
                  setSelectedTag(null);
                  setSelectedItemIds([]);
                }}
                className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-xs font-semibold tracking-wide transition-all ${
                  activeSidebar === "all" && !selectedTag
                    ? "bg-indigo-50 text-indigo-700 font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-indigo-500" /> My
                  Workspace
                </span>
                <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">
                  {files.filter((f) => !f.isTrash).length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveSidebar("starred");
                  setSelectedTag(null);
                  setSelectedItemIds([]);
                }}
                className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-xs font-semibold tracking-wide transition-all ${
                  activeSidebar === "starred"
                    ? "bg-sky-50 text-sky-700 font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-sky-500" /> Favorites
                </span>
                <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">
                  {files.filter((f) => f.isStarred && !f.isTrash).length +
                    folders.filter((f) => f.isStarred).length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveSidebar("trash");
                  setSelectedTag(null);
                  setSelectedItemIds([]);
                }}
                className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-xs font-semibold tracking-wide transition-all ${
                  activeSidebar === "trash"
                    ? "bg-red-50 text-red-700 font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-500" /> Recycle Bin
                </span>
                <span className="text-[10px] bg-red-100 px-1.5 py-0.5 rounded text-red-700 font-bold font-mono">
                  {trashedFiles.length}
                </span>
              </button>
            </div>

            <hr className="border-slate-100 animate-pulse" />

            {/* Tags classification */}
            <div className="space-y-2">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Filter by Tags
              </span>
              <div className="flex flex-col gap-1.5">
                {AVAILABLE_TAGS.map((tag) => (
                  <button
                    key={tag.label}
                    onClick={() => {
                      setSelectedTag(
                        tag.label === selectedTag ? null : tag.label,
                      );
                      setActiveSidebar("all"); // Redirect status to all files to respect folder structures or tags nested
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[10px] font-bold uppercase tracking-wider transition ${
                      selectedTag === tag.label
                        ? `${tag.color} ${tag.border} ${tag.text} scale-[1.02] shadow-sm`
                        : "bg-white border-slate-150 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${tag.text.replace("text", "bg")} shrink-0`}
                    />
                    <span className="truncate">{tag.label}</span>
                    {selectedTag === tag.label && (
                      <Check className="ml-auto w-3 h-3 text-current justify-self-end text-right" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Interactive grid list display of selected workspace level */}
        <div className="space-y-4">
          {/* Breadcrumb Path navigation & controls toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-md p-3 px-4 shadow-sm min-h-[50px]">
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 flex-wrap">
              <button
                onClick={() => {
                  setCurrentFolderId(null);
                  setActiveSidebar("all");
                  setSelectedTag(null);
                }}
                className="hover:text-primary transition font-bold"
              >
                Vault Room
              </button>

              {currentPath().map((folder, idx) => (
                <React.Fragment key={folder.id}>
                  <ChevronRight size={14} className="text-slate-400" />
                  <button
                    onClick={() => {
                      setCurrentFolderId(folder.id);
                      setActiveSidebar("all");
                      setSelectedTag(null);
                    }}
                    className={`hover:text-primary transition font-bold truncate max-w-[120px] ${
                      idx === currentPath().length - 1 ? "text-indigo-600" : ""
                    }`}
                  >
                    {folder.name}
                  </button>
                </React.Fragment>
              ))}

              {activeSidebar === "starred" && (
                <>
                  <ChevronRight size={14} className="text-slate-400" />
                  <span className="text-sky-600 font-bold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> Favorites Filter
                  </span>
                </>
              )}
              {activeSidebar === "trash" && (
                <>
                  <ChevronRight size={14} className="text-slate-400" />
                  <span className="text-red-600 font-bold flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-sm">
                    Recycle Bin
                  </span>
                </>
              )}
            </div>

            {/* Interactive actions for current workspace context */}
            <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
              {activeSidebar === "trash" ? (
                <button
                  onClick={handleEmptyTrash}
                  disabled={trashedFiles.length === 0}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 border border-red-200 text-red-600 font-bold uppercase tracking-wider text-[10px] hover:bg-red-50 transition active:scale-95 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Empty Recycle Bin
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsNewFolderOpen(true)}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 border border-indigo-200 text-indigo-600 font-bold uppercase tracking-wider text-[10px] hover:bg-indigo-50/50 transition active:scale-95"
                  >
                    <FolderPlus className="w-3.5 h-3.5" /> Create Folder
                  </button>

                  <button
                    onClick={() => setIsNewTextFileOpen(true)}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 border border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px] hover:bg-slate-50 transition active:scale-95"
                  >
                    <FilePlus className="w-3.5 h-3.5" /> Create Doc
                  </button>
                </>
              )}

              <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

              <div className="flex bg-slate-50 rounded p-1 border border-slate-200">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition ${viewMode === "grid" ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                  title="Grid View"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition ${viewMode === "list" ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Action Ribbon when items are checked */}
          <AnimatePresence>
            {selectedItemIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-indigo-100 bg-indigo-50/80 p-3 px-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-xs text-indigo-950 font-semibold">
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  <span>
                    Selected{" "}
                    <span className="font-bold underline">
                      {selectedItemIds.length}
                    </span>{" "}
                    item(s). Apply operations:
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[9px] font-black uppercase tracking-wider">
                  <button
                    onClick={() => handleBulkStar(true)}
                    className="flex items-center gap-1 bg-white border border-indigo-200 px-3 py-1 rounded-sm text-indigo-700 hover:bg-indigo-50/50"
                  >
                    <Star className="w-3 h-3 fill-current text-amber-500" />{" "}
                    Star Selected
                  </button>
                  <button
                    onClick={() => {
                      setMoveTarget({ ids: selectedItemIds, type: "bulk" });
                      setIsMoveModalOpen(true);
                    }}
                    className="flex items-center gap-1 bg-white border border-indigo-200 px-3 py-1 rounded-sm text-indigo-700 hover:bg-indigo-50/50"
                  >
                    <Archive className="w-3 h-3 text-sky-600" /> Move location
                  </button>
                  <button
                    onClick={handleBulkTrash}
                    className="flex items-center gap-1 bg-red-600 border border-transparent px-3 py-1 rounded-sm text-white hover:bg-red-700"
                  >
                    <Trash2 className="w-3 h-3" /> Move to Trash
                  </button>
                  <button
                    onClick={() => setSelectedItemIds([])}
                    className="bg-slate-200 px-3 py-1 rounded-sm text-slate-700 hover:bg-slate-300"
                  >
                    Clear selection
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Core Content Listing Panel */}
          {getFilteredFolders().length === 0 &&
          getFilteredItems().length === 0 ? (
            /* EMPTY STATES DESIGN */
            <div className="rounded-md border border-slate-200 bg-white p-12 text-center space-y-4 shadow-sm">
              <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                <FileBox size={28} className="text-slate-300" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-slate-800">
                  Folder context empty
                </p>
                <p className="text-xs text-slate-400 font-medium max-w-[280px] mx-auto leading-relaxed">
                  There are no subfolders or files residing here. Upload new
                  documents or create subfolders to configure your vault
                  repository.
                </p>
              </div>
            </div>
          ) : /* GRID VIEW STRUCTURE */
          viewMode === "grid" ? (
            <div className="space-y-6">
              {/* Folders display section */}
              {getFilteredFolders().length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Folders
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {getFilteredFolders().map((folder) => (
                      <div
                        key={folder.id}
                        className={`relative border rounded-md p-3.5 bg-white transition hover:-translate-y-0.5 group cursor-pointer ${
                          focusedItemId === folder.id &&
                          focusedItemType === "folder"
                            ? "border-primary bg-indigo-50/20 ring-1 ring-primary/45"
                            : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                        }`}
                        onClick={() => {
                          setFocusedItemId(folder.id);
                          setFocusedItemType("folder");
                        }}
                        onDoubleClick={() => {
                          setCurrentFolderId(folder.id);
                          setFocusedItemId(folder.id);
                          setFocusedItemType("folder");
                        }}
                      >
                        <div className="flex flex-col justify-between h-full space-y-2.5">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5 truncate">
                                <Folder className="w-5 h-5 text-indigo-500 fill-indigo-50 hover:scale-105 shrink-0" />
                                <span className="text-xs font-bold text-slate-800 truncate select-none">
                                  {folder.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={(e) =>
                                    handleToggleStar(folder.id, "folder", e)
                                  }
                                  className={`text-slate-300 hover:text-amber-500 transition-all ${folder.isStarred ? "text-amber-500 font-bold" : ""}`}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${folder.isStarred ? "fill-current" : ""}`}
                                  />
                                </button>

                                {/* Inline mini-menu options */}
                                <div className="relative group/menu">
                                  <button className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition animate-duration-150">
                                    <MoreVertical size={13} />
                                  </button>
                                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded shadow-md z-40 hidden group-hover/menu:block py-1 min-w-[120px] text-[10px]">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRenameTarget({
                                          id: folder.id,
                                          type: "folder",
                                          name: folder.name,
                                        });
                                        setRenameValue(folder.name);
                                        setIsRenameModalOpen(true);
                                      }}
                                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-semibold"
                                    >
                                      Rename folder
                                    </button>
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          if (user) {
                                            await deleteDoc(
                                              doc(db, "folders", folder.id),
                                            );
                                          } else {
                                            const nextFolders = folders.filter(
                                              (f) => f.id !== folder.id,
                                            );
                                            syncToDisk(nextFolders, files);
                                          }
                                          if (focusedItemId === folder.id) {
                                            setFocusedItemId(null);
                                          }
                                          toast.error(
                                            "Folder removed permanently",
                                          );
                                        } catch (err) {
                                          toast.error(
                                            "Delete operation failed",
                                          );
                                        }
                                      }}
                                      className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 font-bold border-t border-slate-100"
                                    >
                                      Format Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Tags display indicators to satisfy tagging requirements */}
                            {folder.tags && folder.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 leading-none shrink-0 pt-1">
                                {folder.tags.map((t) => {
                                  const config = AVAILABLE_TAGS.find(
                                    (tc) => tc.label === t,
                                  );
                                  return (
                                    <span
                                      key={t}
                                      className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${config?.color || "bg-slate-100"} ${config?.border || "border-slate-200"} ${config?.text || "text-slate-600"}`}
                                    >
                                      {t}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between text-[9px] font-mono text-slate-400 border-t border-slate-50 pt-2 shrink-0">
                            <span>
                              {
                                files.filter(
                                  (f) => f.folderId === folder.id && !f.isTrash,
                                ).length
                              }{" "}
                              item(s)
                            </span>
                            <span>
                              {new Date(folder.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files display section */}
              {getFilteredItems().length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Files
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {getFilteredItems().map((file) => (
                      <div
                        key={file.id}
                        className={`relative border rounded-md p-3.5 bg-white transition hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between ${
                          focusedItemId === file.id &&
                          focusedItemType === "file"
                            ? "border-primary bg-indigo-50/20 ring-1 ring-primary/45"
                            : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                        }`}
                        onClick={() => {
                          setFocusedItemId(file.id);
                          setFocusedItemType("file");
                        }}
                        onDoubleClick={() => {
                          setPreviewFile(file);
                          setEditBuffer(file.content || "");
                          setIsEditingContent(false);
                        }}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-2.5 truncate">
                              {/* Bulk select checkbox */}
                              <button
                                onClick={(e) => toggleBulkSelect(file.id, e)}
                                className="mt-0.5 text-slate-300 hover:text-primary shrink-0 transition"
                              >
                                {selectedItemIds.includes(file.id) ? (
                                  <CheckSquare
                                    size={15}
                                    className="text-primary fill-indigo-50"
                                  />
                                ) : (
                                  <Square size={15} />
                                )}
                              </button>

                              <div className="p-1 rounded bg-slate-50 border border-slate-100 shrink-0">
                                {getFileIcon(file.type, file.name)}
                              </div>
                              <div className="truncate space-y-0.5">
                                <span
                                  className="text-xs font-bold text-slate-800 block truncate leading-tight select-none"
                                  title={file.name}
                                >
                                  {file.name}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400 block uppercase tracking-wider leading-none">
                                  {formatBytes(file.size)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {!file.isTrash && (
                                <button
                                  onClick={(e) =>
                                    handleToggleStar(file.id, "file", e)
                                  }
                                  className={`text-slate-300 hover:text-amber-500 transition-all ${file.isStarred ? "text-amber-500 font-bold" : ""}`}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${file.isStarred ? "fill-current" : ""}`}
                                  />
                                </button>
                              )}

                              {/* Context Action button */}
                              <div className="relative group/menu">
                                <button className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                                  <MoreVertical size={13} />
                                </button>
                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded shadow-md z-40 hidden group-hover/menu:block py-1 min-w-[120px] text-[10px] w-32">
                                  {file.isTrash ? (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRestoreFromTrash(file.id);
                                        }}
                                        className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-semibold"
                                      >
                                        Restore file
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeletePermanently(file.id);
                                        }}
                                        className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 font-bold border-t border-slate-100"
                                      >
                                        Wipe Delete
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRenameTarget({
                                            id: file.id,
                                            type: "file",
                                            name: file.name,
                                          });
                                          setRenameValue(file.name);
                                          setIsRenameModalOpen(true);
                                        }}
                                        className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-semibold"
                                      >
                                        Rename file
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMoveTarget({
                                            ids: [file.id],
                                            type: "single",
                                          });
                                          setIsMoveModalOpen(true);
                                        }}
                                        className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-semibold"
                                      >
                                        Move folder location
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSendToTrash(file.id);
                                        }}
                                        className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 font-bold border-t border-slate-100"
                                      >
                                        Send to Trash
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Tags display indicators */}
                          {file.tags && file.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 leading-none shrink-0 pt-1">
                              {file.tags.map((t) => {
                                const config = AVAILABLE_TAGS.find(
                                  (tc) => tc.label === t,
                                );
                                return (
                                  <span
                                    key={t}
                                    className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${config?.color || "bg-slate-100"} ${config?.border || "border-slate-200"} ${config?.text || "text-slate-600"}`}
                                  >
                                    {t}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[9px] font-mono text-slate-400">
                          <span>Modified:</span>
                          <span>
                            {new Date(file.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* LIST VIEW STRUCTURE */
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-sm">
              <table className="w-full border-collapse text-left text-xs text-slate-600">
                <thead className="bg-[#fcfdff] border-b border-slate-200 text-slate-400 font-bold text-[9px] uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-3 w-8">#</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3 w-28 text-right">Size</th>
                    <th className="px-4 py-3 w-40">Last Action Date</th>
                    <th className="px-4 py-3 w-28">Tags</th>
                    <th className="px-4 py-3 w-12 text-center">Opt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {/* Folders in list */}
                  {getFilteredFolders().map((folder) => (
                    <tr
                      key={folder.id}
                      className={`hover:bg-slate-50/50 cursor-pointer ${focusedItemId === folder.id && focusedItemType === "folder" ? "bg-indigo-50/20" : ""}`}
                      onClick={() => {
                        setFocusedItemId(folder.id);
                        setFocusedItemType("folder");
                      }}
                      onDoubleClick={() => setCurrentFolderId(folder.id)}
                    >
                      <td className="px-4 py-3">
                        <Folder className="w-4 h-4 text-indigo-500 shrink-0" />
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        <span className="truncate block max-w-[280px]">
                          {folder.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400">
                        —
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {new Date(folder.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {folder.tags?.slice(0, 1).map((t) => (
                            <span
                              key={t}
                              className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-slate-100"
                            >
                              {t}
                            </span>
                          ))}
                          {folder.tags && folder.tags.length > 1 && (
                            <span className="text-[7.5px] font-mono font-bold text-slate-400">
                              +{folder.tags.length - 1}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) =>
                            handleToggleStar(folder.id, "folder", e)
                          }
                          className={`text-slate-300 hover:text-amber-500 transition-all ${folder.isStarred ? "text-amber-500" : ""}`}
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Files in list */}
                  {getFilteredItems().map((file) => (
                    <tr
                      key={file.id}
                      className={`hover:bg-slate-50/50 cursor-pointer ${focusedItemId === file.id && focusedItemType === "file" ? "bg-indigo-50/20" : ""}`}
                      onClick={() => {
                        setFocusedItemId(file.id);
                        setFocusedItemType("file");
                      }}
                      onDoubleClick={() => {
                        setPreviewFile(file);
                        setEditBuffer(file.content || "");
                        setIsEditingContent(false);
                      }}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => toggleBulkSelect(file.id, e)}
                          className="text-slate-300 hover:text-primary transition"
                        >
                          {selectedItemIds.includes(file.id) ? (
                            <CheckSquare size={14} className="text-primary" />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getFileIcon(file.type, file.name)}
                          <span className="font-bold text-slate-800 truncate block max-w-[280px]">
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500 font-semibold">
                        {formatBytes(file.size)}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {new Date(file.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {file.tags?.slice(0, 1).map((t) => (
                            <span
                              key={t}
                              className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-slate-100"
                            >
                              {t}
                            </span>
                          ))}
                          {file.tags && file.tags.length > 1 && (
                            <span className="text-[7.5px] font-mono font-bold text-slate-400">
                              +{file.tags.length - 1}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => handleToggleStar(file.id, "file", e)}
                          className={`text-slate-300 hover:text-amber-500 transition-all ${file.isStarred ? "text-amber-500" : ""}`}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${file.isStarred ? "fill-current" : ""}`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Floating Detailed Metadata Drawer on right when item is selected */}
      <AnimatePresence>
        {activeFocusItem && (
          <motion.div
            initial={{ opacity: 0, x: 260 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 260 }}
            className="fixed top-0 right-0 h-screen w-80 bg-white border-l border-slate-200 shadow-2xl z-50 p-6 flex flex-col justify-between"
          >
            <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-120px)] scrollbar-none">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Info size={14} /> Element Properties
                </h3>
                <button
                  onClick={() => setFocusedItemId(null)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Title block */}
              <div className="text-center py-4 space-y-2 bg-slate-50 rounded-md border border-slate-100">
                <div className="mx-auto w-10 h-10 rounded-full flex items-center justify-center bg-white border shadow-sm">
                  {focusedItemType === "file" ? (
                    getFileIcon(
                      (activeFocusItem as FileItem).type,
                      activeFocusItem.name,
                    )
                  ) : (
                    <Folder className="w-5 h-5 text-indigo-500" />
                  )}
                </div>
                <div className="px-4">
                  <h4 className="text-xs font-bold text-slate-800 break-all leading-tight">
                    {activeFocusItem.name}
                  </h4>
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block pt-0.5">
                    {focusedItemType === "file"
                      ? "Document File"
                      : "Virtual Directory"}
                  </span>
                </div>
              </div>

              {/* Tag modification section on focused file or folder */}
              {(focusedItemType === "file" || focusedItemType === "folder") && (
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                    Configure Tags
                  </span>
                  <div className="flex flex-wrap gap-1 bg-slate-50 p-3 rounded border border-slate-100">
                    {AVAILABLE_TAGS.map((at) => {
                      const itemTags = activeFocusItem.tags || [];
                      const hasTag = itemTags.includes(at.label);
                      return (
                        <button
                          key={at.label}
                          onClick={async () => {
                            const nextTags = hasTag
                              ? itemTags.filter((t) => t !== at.label)
                              : [...itemTags, at.label];

                            try {
                              if (focusedItemType === "file") {
                                if (user) {
                                  await setDoc(
                                    doc(db, "files", activeFocusItem.id),
                                    sanitizeForFirestore({
                                      ...activeFocusItem,
                                      tags: nextTags,
                                      updatedAt: Date.now(),
                                    }),
                                    { merge: true },
                                  );
                                } else {
                                  const nextFiles = files.map((f) =>
                                    f.id === activeFocusItem.id
                                      ? { ...f, tags: nextTags }
                                      : f,
                                  );
                                  syncToDisk(folders, nextFiles);
                                }
                              } else {
                                if (user) {
                                  await setDoc(
                                    doc(db, "folders", activeFocusItem.id),
                                    sanitizeForFirestore({
                                      ...activeFocusItem,
                                      tags: nextTags,
                                      updatedAt: Date.now(),
                                    }),
                                    { merge: true },
                                  );
                                } else {
                                  const nextFolders = folders.map((f) =>
                                    f.id === activeFocusItem.id
                                      ? { ...f, tags: nextTags }
                                      : f,
                                  );
                                  syncToDisk(nextFolders, files);
                                }
                              }
                            } catch (e) {
                              toast.error("Tag update failed to sync");
                            }
                          }}
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition ${
                            hasTag
                              ? `${at.color} ${at.border} ${at.text}`
                              : "bg-white border-transparent text-slate-400 hover:bg-slate-100"
                          }`}
                        >
                          {at.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detailed specs */}
              <div className="space-y-2.5 text-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                  Metadata specs
                </span>

                <div className="divide-y divide-slate-100 bg-[#fbfdff] border border-slate-100 rounded-md p-3 font-medium text-slate-705 text-[11px]">
                  {focusedItemType === "file" && (
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">Disk Weight</span>
                      <span className="font-mono text-slate-700 font-bold">
                        {formatBytes((activeFocusItem as FileItem).size)}
                      </span>
                    </div>
                  )}
                  {focusedItemType === "file" && (
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">File Type</span>
                      <span
                        className="text-slate-700 truncate max-w-[120px]"
                        title={(activeFocusItem as FileItem).type}
                      >
                        {(activeFocusItem as FileItem).type}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Created date</span>
                    <span className="font-mono text-slate-750">
                      {new Date(activeFocusItem.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Last activity</span>
                    <span className="font-mono text-slate-750">
                      {new Date(activeFocusItem.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Extra Inspector actions footer */}
            <div className="border-t pt-4 space-y-2">
              {focusedItemType === "file" && (
                <button
                  onClick={() => {
                    setPreviewFile(activeFocusItem as FileItem);
                    setEditBuffer((activeFocusItem as FileItem).content || "");
                    setIsEditingContent(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 bg-primary py-2.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-white transition hover:bg-primary-hover shadow-sm"
                >
                  <Eye size={13} /> Open Live Viewer
                </button>
              )}

              <button
                onClick={() => {
                  if (focusedItemType === "file") {
                    handleSendToTrash(activeFocusItem.id);
                  } else {
                    const nextFolders = folders.filter(
                      (f) => f.id !== activeFocusItem.id,
                    );
                    syncToDisk(nextFolders, files);
                    setFocusedItemId(null);
                    toast.success("Folder removed permanently");
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 border border-red-200 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest text-red-600 hover:bg-red-50 transition"
              >
                <Trash2 size={13} /> Delete item
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL PREVIEW & INTERACTIVE EDITOR MODAL */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-md border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col justify-between"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between border-b px-6 py-4 bg-slate-50">
                <div className="flex items-center gap-2">
                  {getFileIcon(previewFile.type, previewFile.name)}
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 truncate max-w-[400px] leading-tight">
                      {previewFile.name}
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400">
                      Size: {formatBytes(previewFile.size)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal viewport container */}
              <div className="flex-1 p-6 overflow-y-auto bg-slate-100 min-h-[350px] max-h-[50vh]">
                {/* Images Viewport */}
                {previewFile.imageBlob && (
                  <div className="flex items-center justify-center h-full">
                    <img
                      src={previewFile.imageBlob}
                      alt={previewFile.name}
                      referrerPolicy="no-referrer"
                      className="max-h-[400px] object-contain rounded border shadow shadow-slate-200"
                    />
                  </div>
                )}

                {/* PDFs simulator */}
                {previewFile.type.includes("pdf") && (
                  <div className="bg-white p-8 max-w-2xl mx-auto rounded border shadow-sm space-y-4 text-center">
                    <FileText size={48} className="text-red-500 mx-auto" />
                    <h4 className="text-slate-800 font-bold text-sm">
                      Adaptive PDF Document Reader
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      PDF loading asserts successfully. For custom overlays or
                      complex layout reconstructions, open this target directly
                      in our dedicated PDF Editor.
                    </p>
                    <button
                      onClick={() => {
                        setPreviewFile(null);
                        // Simply link over for better utility transition
                        window.location.href = "/edit-pdf";
                      }}
                      className="inline-block bg-primary px-6 py-2 rounded text-[10px] font-bold text-white uppercase tracking-widest hover:bg-primary-hover shadow-sm"
                    >
                      Process PDF Editor
                    </button>
                  </div>
                )}

                {/* Text editor and content viewport */}
                {!previewFile.imageBlob &&
                  !previewFile.type.includes("pdf") && (
                    <div className="bg-white rounded-md border border-slate-200 shadow-inner p-4 min-h-[300px] font-mono">
                      {isEditingContent ? (
                        <textarea
                          value={editBuffer}
                          onChange={(e) => setEditBuffer(e.target.value)}
                          className="w-full h-[280px] text-xs text-slate-800 outline-none resize-none font-mono focus:ring-0 focus:border-transparent leading-relaxed"
                          placeholder="Write details and document logs..."
                        />
                      ) : (
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {previewFile.content ||
                            "(No readable textual content detected on this file.)"}
                        </pre>
                      )}
                    </div>
                  )}
              </div>

              {/* Modal Controls footer */}
              <div className="border-t px-6 py-4 bg-slate-50 flex items-center justify-between">
                <div>
                  {!previewFile.imageBlob &&
                    !previewFile.type.includes("pdf") && (
                      <button
                        onClick={() => {
                          if (isEditingContent) {
                            handleSaveTextEdit();
                          } else {
                            setIsEditingContent(true);
                          }
                        }}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-indigo-600 text-white px-5 py-2 rounded hover:bg-indigo-700 transition"
                      >
                        {isEditingContent ? (
                          <>
                            <Save size={14} /> Save Code Changes
                          </>
                        ) : (
                          <>
                            <Edit3 size={14} /> Edit File Content
                          </>
                        )}
                      </button>
                    )}
                </div>

                <div className="flex gap-2">
                  {/* Download file content capability */}
                  <button
                    onClick={() => {
                      const blobData = previewFile.imageBlob
                        ? previewFile.imageBlob
                        : "data:text/plain;charset=utf-8," +
                          encodeURIComponent(previewFile.content || "");

                      const element = document.createElement("a");
                      element.href = blobData;
                      element.download = previewFile.name;
                      document.body.appendChild(element);
                      element.click();
                      document.body.removeChild(element);
                      toast.success("Downloading processed file package");
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest border border-slate-300 text-slate-700 px-5 py-2 rounded hover:bg-slate-200 transition"
                  >
                    <Download size={14} /> Download Document
                  </button>
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition"
                  >
                    Cancel / Exit
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE NEW VIRTUAL FOLDER */}
      <AnimatePresence>
        {isNewFolderOpen && (
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border rounded-md shadow-xl p-6 max-w-sm w-full space-y-4"
            >
              <div className="flex items-center gap-2 pb-2 border-b">
                <FolderPlus className="text-primary w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Create New Folder
                </h3>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Folder Label Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Design Iterations"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded p-2.5 text-xs text-slate-700 outline-none focus:border-primary transition"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                  }}
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    setNewFolderName("");
                    setIsNewFolderOpen(false);
                  }}
                  className="bg-slate-100 px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  className="bg-primary px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest text-white hover:bg-primary-hover transition"
                >
                  Generate Folder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE TEXT DOCUMENT / LOG FILE */}
      <AnimatePresence>
        {isNewTextFileOpen && (
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border rounded-md shadow-xl p-6 max-w-md w-full space-y-4"
            >
              <div className="flex items-center gap-2 pb-2 border-b">
                <FilePlus className="text-primary w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Generate Text Document
                </h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    File Name (include extension)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. report.txt or tasklist.md"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 rounded p-2.5 text-xs text-slate-700 outline-none focus:border-primary transition font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Initial logs/text data
                  </label>
                  <textarea
                    placeholder="Generate document logs details..."
                    value={newFileContent}
                    onChange={(e) => setNewFileContent(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 rounded p-2 text-xs text-slate-700 outline-none focus:border-primary resize-none h-32 transition font-mono leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    setNewFileName("untitled.txt");
                    setNewFileContent("");
                    setIsNewTextFileOpen(false);
                  }}
                  className="bg-slate-100 px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFile}
                  className="bg-primary px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest text-white hover:bg-primary-hover transition"
                >
                  Create Doc
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: RENAME ELEMENT */}
      <AnimatePresence>
        {isRenameModalOpen && renameTarget && (
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border rounded-md shadow-xl p-6 max-w-sm w-full space-y-4"
            >
              <div className="flex items-center gap-2 pb-2 border-b">
                <Edit3 className="text-primary w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Rename {renameTarget.type === "file" ? "Document" : "Folder"}
                </h3>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  New name value
                </label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded p-2.5 text-xs text-slate-700 outline-none focus:border-primary transition font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                  }}
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    setRenameTarget(null);
                    setRenameValue("");
                    setIsRenameModalOpen(false);
                  }}
                  className="bg-slate-100 px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRename}
                  className="bg-primary px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest text-white hover:bg-primary-hover transition"
                >
                  Confirm rename
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: MOVE LOCATION SELECTOR */}
      <AnimatePresence>
        {isMoveModalOpen && moveTarget && (
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border rounded-md shadow-xl p-6 max-w-sm w-full space-y-4"
            >
              <div className="flex items-center gap-2 pb-2 border-b">
                <Archive className="text-primary w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Move Target Item(s)
                </h3>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Destination Folder
                </label>

                <div className="max-h-48 overflow-y-auto border border-slate-150 rounded divide-y divide-slate-100 text-xs">
                  <button
                    onClick={() => setMoveDestinationId(null)}
                    className={`w-full text-left p-2.5 flex items-center justify-between font-bold ${
                      moveDestinationId === null
                        ? "bg-indigo-50 text-primary"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span>Vault Room (Root)</span>
                    {moveDestinationId === null && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </button>

                  {folders
                    // Filter out folders currently being moved if doing single/bulk folder move simulation
                    .filter((f) => !moveTarget.ids.includes(f.id))
                    .map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => setMoveDestinationId(folder.id)}
                        className={`w-full text-left p-2.5 flex items-center justify-between font-bold ${
                          moveDestinationId === folder.id
                            ? "bg-indigo-50 text-primary"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Folder size={14} className="text-slate-400" />
                          {folder.name}
                        </span>
                        {moveDestinationId === folder.id && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    setMoveTarget(null);
                    setMoveDestinationId(null);
                    setIsMoveModalOpen(false);
                  }}
                  className="bg-slate-100 px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveSelection}
                  className="bg-primary px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest text-white hover:bg-primary-hover transition"
                >
                  confirm relocation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
