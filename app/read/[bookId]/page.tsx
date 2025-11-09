import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import BookReader from "@/components/BookReader";

interface PageProps {
  params: {
    bookId: string;
  };
}

async function getBookData(bookId: string, userId: string) {
  try {
    // Fetch book with all related data
    const book = await db.book.findUnique({
      where: {
        id: bookId,
      },
      include: {
        pages: {
          orderBy: {
            pageNumber: "asc",
          },
          include: {
            scene: {
              include: {
                soundscapes: {
                  orderBy: {
                    createdAt: "desc",
                  },
                  take: 1, // Get the latest soundscape for each scene
                },
              },
            },
          },
        },
        scenes: {
          orderBy: {
            pageSpreadIndex: "asc",
          },
          include: {
            soundscapes: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        },
        readingProgress: {
          where: {
            userId: userId,
          },
        },
      },
    });

    // Check if book exists
    if (!book) {
      return null;
    }

    // Check if user owns the book
    if (book.userId !== userId) {
      return null;
    }

    return book;
  } catch (error) {
    console.error("Error fetching book data:", error);
    throw error;
  }
}

export default async function ReadPage({ params }: PageProps) {
  // Check authentication
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/read/" + params.bookId);
  }

  // Fetch book data
  const book = await getBookData(params.bookId, session.user.id);

  // Handle book not found or unauthorized
  if (!book) {
    notFound();
  }

  // Check if book is ready for reading
  if (book.status === "processing") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Processing Your Book
          </h1>
          <p className="text-gray-600 mb-4">
            We&apos;re analyzing &quot;{book.title}&quot; and generating immersive soundscapes.
            This may take a few minutes.
          </p>
          <p className="text-sm text-gray-500">
            You can safely close this page and return later. We&apos;ll notify you when it&apos;s ready.
          </p>
          <a
            href="/library"
            className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Return to Library
          </a>
        </div>
      </div>
    );
  }

  if (book.status === "failed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Processing Failed
          </h1>
          <p className="text-gray-600 mb-4">
            We encountered an error while processing &quot;{book.title}&quot;. Please try uploading it again.
          </p>
          <a
            href="/library"
            className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Return to Library
          </a>
        </div>
      </div>
    );
  }

  // Get initial page from reading progress or start at page 1
  const initialPage = book.readingProgress[0]?.currentPage || 1;

  return (
    <BookReader
      book={book}
      initialPage={initialPage}
      userId={session.user.id}
    />
  );
}
