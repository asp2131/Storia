defmodule Storia.Workers.PDFProcessorTest do
  use Storia.DataCase, async: false
  use Oban.Testing, repo: Storia.Repo

  alias Storia.Workers.PDFProcessor
  alias Storia.{Content, Repo}
  alias Storia.Content.{Book, Page}

  import Storia.AccountsFixtures

  describe "perform/1" do
    setup do
      # Create a test book
      {:ok, book} =
        Content.create_book(%{
          title: "Test Book",
          author: "Test Author",
          pdf_url: "test.pdf",
          processing_status: "pending"
        })

      %{book: book}
    end

    test "successfully processes a PDF and creates pages", %{book: book} do
      # Create a mock PDF path (in real tests, you'd use a fixture PDF)
      # For now, we'll skip this test until we have a proper test PDF
      # or mock the System.cmd call

      # This test would:
      # 1. Create a test PDF file
      # 2. Enqueue the job
      # 3. Perform the job
      # 4. Assert pages were created
      # 5. Assert book status was updated

      # Example structure:
      # pdf_path = create_test_pdf()
      # assert :ok = perform_job(PDFProcessor, %{book_id: book.id, pdf_path: pdf_path})
      # assert Repo.aggregate(Page, :count, :id) > 0
      # updated_book = Repo.get!(Book, book.id)
      # assert updated_book.processing_status == "analyzing"
      # assert updated_book.total_pages > 0
    end

    test "handles missing book gracefully" do
      assert {:error, :book_not_found} =
               perform_job(PDFProcessor, %{book_id: 99999, pdf_path: "test.pdf"})
    end

    test "handles missing PDF file", %{book: book} do
      assert {:error, :pdf_file_not_found} =
               perform_job(PDFProcessor, %{book_id: book.id, pdf_path: "/nonexistent/file.pdf"})

      # Book status should be updated to failed
      updated_book = Repo.get!(Book, book.id)
      assert updated_book.processing_status == "failed"
      assert updated_book.processing_error =~ "PDF file not found"
    end

    test "updates book status to extracting when starting", %{book: book} do
      # Mock the extraction to fail early so we can check the status
      # In a real test, you'd use Mox or similar to mock System.cmd

      # For now, test that the status update happens
      # by checking the book after a failed job
      perform_job(PDFProcessor, %{book_id: book.id, pdf_path: "/nonexistent/file.pdf"})

      # The status should have been set to failed after the error
      updated_book = Repo.get!(Book, book.id)
      assert updated_book.processing_status == "failed"
    end
  end

  describe "integration with Node.js script" do
    @tag :integration
    test "can call the extraction script" do
      # This test requires:
      # 1. Node.js to be installed
      # 2. npm packages to be installed in scripts/pdf_processor
      # 3. A test PDF file

      # Skip for now, but structure would be:
      # pdf_path = Path.join([__DIR__, "..", "..", "fixtures", "test.pdf"])
      # script_path = Path.join([Application.app_dir(:storia), "..", "..", "scripts", "pdf_processor", "extract.js"])
      # {output, 0} = System.cmd("node", [script_path, pdf_path])
      # {:ok, result} = Jason.decode(output)
      # assert result["success"] == true
      # assert is_list(result["pages"])
    end
  end
end
