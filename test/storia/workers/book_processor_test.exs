defmodule Storia.Workers.BookProcessorTest do
  use Storia.DataCase, async: false

  alias Storia.Workers.BookProcessor
  alias Storia.Content

  describe "BookProcessor" do
    test "creates job successfully with valid book_id" do
      # Test that we can create a job changeset
      job_changeset = BookProcessor.new(%{book_id: "test-id"})

      assert %Ecto.Changeset{} = job_changeset
      assert get_change(job_changeset, :args) == %{book_id: "test-id"}
      assert get_change(job_changeset, :worker) == "Storia.Workers.BookProcessor"
      assert get_change(job_changeset, :queue) == "pdf_processing"
    end

    test "perform fails gracefully with invalid book_id" do
      # Create a mock Oban.Job struct
      job = %Oban.Job{
        args: %{"book_id" => "invalid-id"},
        attempt: 1,
        max_attempts: 3,
        queue: "pdf_processing",
        worker: "Storia.Workers.BookProcessor"
      }

      result = BookProcessor.perform(job)

      assert {:error, :book_not_found} = result
    end
  end
end
