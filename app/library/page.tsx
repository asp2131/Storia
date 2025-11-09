"use client";

import { useState, useRef, DragEvent, ChangeEvent, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BookGridSkeleton } from "@/components/ui/BookCardSkeleton";
import { useToast } from "@/components/ui/ToastContainer";

interface Book {
  id: string;
  title: string;
  author: string | null;
  status: "processing" | "ready" | "failed";
  totalPages: number;
  createdAt: string;
  readingProgress?: {
    currentPage: number;
  }[];
}

interface UploadedBook {
  id: string;
  title: string;
  author: string | null;
  status: "processing" | "ready" | "failed";
  createdAt: string;
}

export default function LibraryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedBook, setUploadedBook] = useState<UploadedBook | null>(null);

  // Books state
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);

  // Validation errors
  const [titleError, setTitleError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Fetch books on mount
  useEffect(() => {
    if (status === "authenticated") {
      fetchBooks();
    }
  }, [status]);

  const fetchBooks = async () => {
    try {
      setIsLoadingBooks(true);
      const response = await fetch("/api/books");
      if (response.ok) {
        const data = await response.json();
        setBooks(data.books || []);
      }
    } catch (error) {
      console.error("Error fetching books:", error);
    } finally {
      setIsLoadingBooks(false);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!confirm("Are you sure you want to delete this book? This action cannot be undone.")) {
      return;
    }

    try {
      setDeletingBookId(bookId);
      const response = await fetch(`/api/books/${bookId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const data = await response.json();
        // Remove book from state
        setBooks(books.filter((book) => book.id !== bookId));
        toast.success(data.message || "Book deleted successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete book");
      }
    } catch (error) {
      console.error("Error deleting book:", error);
      toast.error("Failed to delete book");
    } finally {
      setDeletingBookId(null);
    }
  };

  // Redirect to login if not authenticated
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const validateFile = (file: File): string | null => {
    // Check file type
    if (file.type !== "application/pdf") {
      return "Only PDF files are allowed";
    }

    // Check file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return `File size must be less than ${maxSize / 1024 / 1024}MB`;
    }

    return null;
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validationError = validateFile(file);

      if (validationError) {
        setFileError(validationError);
        setSelectedFile(null);
      } else {
        setFileError(null);
        setSelectedFile(file);
        // Auto-populate title from filename if empty
        if (!title) {
          const filename = file.name.replace(/\.pdf$/i, "");
          setTitle(filename);
        }
      }
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validationError = validateFile(file);

      if (validationError) {
        setFileError(validationError);
        setSelectedFile(null);
      } else {
        setFileError(null);
        setSelectedFile(file);
        // Auto-populate title from filename if empty
        if (!title) {
          const filename = file.name.replace(/\.pdf$/i, "");
          setTitle(filename);
        }
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    // Reset errors
    setError(null);
    setTitleError(null);
    setFileError(null);

    // Validate title
    if (!title.trim()) {
      setTitleError("Book title is required");
      return;
    }

    // Validate file
    if (!selectedFile) {
      setFileError("Please select a PDF file");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Create form data
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title.trim());
      if (author.trim()) {
        formData.append("author", author.trim());
      }

      // Simulate progress (since we can't track actual upload progress easily)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload file
      const response = await fetch("/api/books/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Upload failed");
      }

      // Success!
      setUploadedBook(data.book);
      toast.success(`"${data.book.title}" uploaded successfully! Processing will begin shortly.`);
      
      // Refresh books list
      fetchBooks();
      
      // Reset form
      setSelectedFile(null);
      setTitle("");
      setAuthor("");
      setUploadProgress(0);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Upload error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to upload book";
      setError(errorMessage);
      toast.error(errorMessage);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setTitle("");
    setAuthor("");
    setError(null);
    setTitleError(null);
    setFileError(null);
    setUploadedBook(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Library</h1>
          <p className="mt-2 text-gray-600">
            Upload PDF books to experience them with AI-generated soundscapes
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload New Book</h2>

          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            } ${fileError ? "border-red-500" : ""}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile ? (
              <div className="space-y-2">
                <svg
                  className="mx-auto h-12 w-12 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-medium text-gray-900">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={handleReset}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Choose different file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="text-sm text-gray-600">
                  <button
                    onClick={handleBrowseClick}
                    className="font-medium text-blue-600 hover:text-blue-700"
                  >
                    Click to upload
                  </button>
                  <span> or drag and drop</span>
                </div>
                <p className="text-xs text-gray-500">PDF files up to 50MB</p>
              </div>
            )}
          </div>

          {fileError && (
            <p className="mt-2 text-sm text-red-600">{fileError}</p>
          )}

          {/* Book Details Form */}
          <div className="mt-6 space-y-4">
            <Input
              label="Book Title *"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter book title"
              error={titleError || undefined}
              disabled={isUploading}
            />

            <Input
              label="Author (Optional)"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Enter author name"
              disabled={isUploading}
            />
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="mt-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {uploadedBook && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <svg
                  className="h-5 w-5 text-green-500 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Upload Successful!
                  </h3>
                  <p className="mt-1 text-sm text-green-700">
                    {uploadedBook.title} has been uploaded and is now being
                    processed.
                  </p>
                  <p className="mt-2 text-xs text-green-600">
                    Status:{" "}
                    <span className="font-medium capitalize">
                      {uploadedBook.status}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !title.trim() || isUploading}
              isLoading={isUploading}
              className="flex-1"
            >
              {isUploading ? "Uploading..." : "Upload Book"}
            </Button>
            {(selectedFile || title || author) && !isUploading && (
              <Button onClick={handleReset} variant="outline">
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Books Grid */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-6">Your Books</h2>
          
          {isLoadingBooks ? (
            <BookGridSkeleton count={6} />
          ) : books.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <p className="mt-4">No books uploaded yet</p>
              <p className="text-sm mt-2">
                Upload your first PDF book to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {books.map((book) => {
                const currentPage = book.readingProgress?.[0]?.currentPage || 0;
                const progress = currentPage > 0 ? Math.round((currentPage / book.totalPages) * 100) : 0;
                
                return (
                  <div
                    key={book.id}
                    className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Book Cover */}
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 h-48 flex items-center justify-center relative">
                      <div className="text-white text-center p-4">
                        <svg
                          className="w-16 h-16 mx-auto mb-2 opacity-50"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                        </svg>
                        <h3 className="font-bold text-lg line-clamp-2">
                          {book.title}
                        </h3>
                      </div>
                      
                      {/* Status Badge */}
                      <div className="absolute top-2 right-2">
                        {book.status === "processing" && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Processing
                          </span>
                        )}
                        {book.status === "ready" && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Ready
                          </span>
                        )}
                        {book.status === "failed" && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Failed
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Book Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 line-clamp-1 mb-1">
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="text-sm text-gray-600 mb-2">
                          by {book.author}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mb-3">
                        {book.totalPages} pages
                      </p>
                      
                      {/* Progress Bar */}
                      {progress > 0 && (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>{progress}% complete</span>
                            <span>Page {currentPage}/{book.totalPages}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {book.status === "ready" ? (
                          <Link
                            href={`/read/${book.id}`}
                            className="flex-1 text-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                          >
                            {progress > 0 ? "Continue Reading" : "Start Reading"}
                          </Link>
                        ) : book.status === "processing" ? (
                          <button
                            disabled
                            className="flex-1 px-4 py-2 bg-gray-100 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed"
                          >
                            Processing...
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 px-4 py-2 bg-gray-100 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed"
                          >
                            Failed
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDeleteBook(book.id)}
                          disabled={deletingBookId === book.id}
                          className="px-3 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                          title="Delete book"
                        >
                          {deletingBookId === book.id ? (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
