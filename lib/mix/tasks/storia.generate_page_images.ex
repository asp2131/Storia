defmodule Mix.Tasks.Storia.GeneratePageImages do
  @moduledoc """
  Generates page images from a PDF for the flipbook reader.

  Usage:
      mix storia.generate_page_images BOOK_ID [OPTIONS]

  Options:
      --dpi DPI        Resolution in DPI (default: 125)
      --format FORMAT  Output format: png, jpg, or webp (default: webp)
      --quality NUM    Quality 1-100 (default: 80)

  Examples:
      # Generate WebP images (recommended - best compression)
      mix storia.generate_page_images 1

      # Generate high-res images for desktop
      mix storia.generate_page_images 1 --dpi 150 --quality 85

      # Generate mobile-optimized images
      mix storia.generate_page_images 1 --dpi 100 --quality 75

      # Generate JPEG for compatibility
      mix storia.generate_page_images 1 --format jpg --quality 80

  Requirements:
      - pdftoppm (from poppler-utils): brew install poppler
      OR
      - ImageMagick: brew install imagemagick

  The script will:
  1. Find the PDF for the specified book
  2. Convert each page to an image
  3. Save to priv/static/books/{book_id}/pages/
  4. Images will be named: page-001.png, page-002.png, etc.
  """

  use Mix.Task
  alias Storia.Content

  @shortdoc "Generate page images from a book's PDF"

  @impl Mix.Task
  def run(args) do
    Mix.Task.run("app.start")

    {opts, args, _} =
      OptionParser.parse(args,
        strict: [dpi: :integer, format: :string, quality: :integer],
        aliases: []
      )

    case args do
      [book_id_str] ->
        book_id = String.to_integer(book_id_str)
        dpi = Keyword.get(opts, :dpi, 125)
        format = Keyword.get(opts, :format, "webp")
        quality = Keyword.get(opts, :quality, 80)

        generate_images(book_id, dpi, format, quality)

      _ ->
        Mix.shell().error("Usage: mix storia.generate_page_images BOOK_ID [OPTIONS]")
        Mix.shell().error("Run 'mix help storia.generate_page_images' for more information")
    end
  end

  defp generate_images(book_id, dpi, format, quality) do
    case Content.get_book(book_id) do
      nil ->
        Mix.shell().error("Book with ID #{book_id} not found")

      book ->
        Mix.shell().info("Generating page images for: #{book.title}")
        Mix.shell().info("Settings: DPI=#{dpi}, Format=#{format}, Quality=#{quality}")

        # Find the PDF file
        pdf_path = find_pdf_path(book)

        if pdf_path && File.exists?(pdf_path) do
          output_dir = Path.join([File.cwd!(), "priv", "static", "books", to_string(book_id), "pages"])
          File.mkdir_p!(output_dir)

          # Check which tool is available
          tool = detect_pdf_tool()

          case tool do
            :pdftoppm ->
              generate_with_pdftoppm(pdf_path, output_dir, dpi, format, quality, book.total_pages)

            :imagemagick ->
              generate_with_imagemagick(pdf_path, output_dir, dpi, format, quality, book.total_pages)

            :none ->
              Mix.shell().error("""
              No PDF conversion tool found. Please install one of:

              Option 1 (Recommended): pdftoppm from poppler-utils
                  macOS:   brew install poppler
                  Ubuntu:  sudo apt-get install poppler-utils

              Option 2: ImageMagick
                  macOS:   brew install imagemagick
                  Ubuntu:  sudo apt-get install imagemagick
              """)
          end
        else
          Mix.shell().error("PDF not found at: #{inspect(pdf_path)}")
          Mix.shell().info("Make sure the PDF exists and book.pdf_url is correct")
        end
    end
  end

  defp find_pdf_path(book) do
    cond do
      # Check if pdf_url is an absolute path
      String.starts_with?(book.pdf_url || "", "/") && File.exists?(book.pdf_url) ->
        book.pdf_url

      # Check in priv/static
      String.starts_with?(book.pdf_url || "", "/books/") ->
        priv_path = Path.join([File.cwd!(), "priv", "static", book.pdf_url])
        if File.exists?(priv_path), do: priv_path

      # Check in project root
      true ->
        root_path = Path.join(File.cwd!(), "#{book.title}.pdf")
        if File.exists?(root_path), do: root_path
    end
  end

  defp detect_pdf_tool do
    cond do
      system_command_exists?("pdftoppm") -> :pdftoppm
      system_command_exists?("convert") -> :imagemagick
      true -> :none
    end
  end

  defp system_command_exists?(command) do
    case System.cmd("which", [command], stderr_to_stdout: true) do
      {output, 0} -> String.trim(output) != ""
      _ -> false
    end
  rescue
    _ -> false
  end

  defp generate_with_pdftoppm(pdf_path, output_dir, dpi, format, quality, _total_pages) do
    Mix.shell().info("Using pdftoppm to generate images...")

    # For WebP, generate PNG first then convert
    temp_format = if format == "webp", do: "png", else: format
    format_flag = if temp_format == "jpg", do: "-jpeg", else: "-png"
    output_prefix = Path.join(output_dir, "page")

    args = [
      format_flag,
      "-r",
      to_string(dpi),
      pdf_path,
      output_prefix
    ]

    case System.cmd("pdftoppm", args, stderr_to_stdout: true) do
      {_output, 0} ->
        # pdftoppm creates files like page-01.png, page-02.png
        # Rename them to have zero-padded numbers: page-001.png, page-002.png
        rename_generated_files(output_dir, temp_format)

        # Convert to WebP if requested
        if format == "webp" do
          convert_to_webp(output_dir, quality)
        end

        Mix.shell().info("✅ Successfully generated #{count_images(output_dir, format)} page images")
        Mix.shell().info("📁 Images saved to: #{output_dir}")

      {output, _} ->
        Mix.shell().error("Failed to generate images: #{output}")
    end
  end

  defp generate_with_imagemagick(pdf_path, output_dir, dpi, format, quality, _total_pages) do
    Mix.shell().info("Using ImageMagick to generate images...")
    Mix.shell().info("This may take a while for large PDFs...")

    # ImageMagick converts all pages at once
    output_pattern = Path.join(output_dir, "page-%03d.#{format}")

    args =
      [
        "-density",
        to_string(dpi),
        pdf_path,
        "-quality",
        to_string(quality),
        output_pattern
      ]

    case System.cmd("convert", args, stderr_to_stdout: true) do
      {_output, 0} ->
        Mix.shell().info("✅ Successfully generated #{count_images(output_dir, format)} page images")
        Mix.shell().info("📁 Images saved to: #{output_dir}")

      {output, _} ->
        Mix.shell().error("Failed to generate images: #{output}")
    end
  end

  defp rename_generated_files(output_dir, format) do
    extension = if format == "jpg", do: ".jpg", else: ".png"

    # pdftoppm uses different naming based on page count
    # For <100 pages: page-1.png, page-2.png
    # For >=100 pages: page-01.png, page-02.png
    # For >=1000 pages: page-001.png, page-002.png

    output_dir
    |> File.ls!()
    |> Enum.filter(&String.ends_with?(&1, extension))
    |> Enum.each(fn file ->
      old_path = Path.join(output_dir, file)

      # Extract page number from filename
      page_num =
        file
        |> String.replace("page-", "")
        |> String.replace(extension, "")
        |> String.to_integer()

      # Create new filename with consistent padding (3 digits)
      new_file = "page-#{String.pad_leading(to_string(page_num), 3, "0")}#{extension}"
      new_path = Path.join(output_dir, new_file)

      unless old_path == new_path do
        File.rename!(old_path, new_path)
      end
    end)
  end

  defp convert_to_webp(output_dir, quality) do
    Mix.shell().info("Converting to WebP format...")

    png_files =
      output_dir
      |> File.ls!()
      |> Enum.filter(&String.ends_with?(&1, ".png"))
      |> Enum.sort()

    Enum.each(png_files, fn png_file ->
      png_path = Path.join(output_dir, png_file)
      webp_file = String.replace(png_file, ".png", ".webp")
      webp_path = Path.join(output_dir, webp_file)

      # Try cwebp first (faster, better quality), fall back to ImageMagick
      cond do
        system_command_exists?("cwebp") ->
          System.cmd("cwebp", ["-q", to_string(quality), png_path, "-o", webp_path], stderr_to_stdout: true)

        system_command_exists?("convert") ->
          System.cmd("convert", [png_path, "-quality", to_string(quality), webp_path], stderr_to_stdout: true)

        true ->
          Mix.shell().error("No WebP converter found. Install cwebp or ImageMagick.")
      end

      # Delete the original PNG file
      File.rm!(png_path)
    end)

    Mix.shell().info("✅ Converted #{length(png_files)} images to WebP")
  end

  defp count_images(output_dir, format \\ nil) do
    extensions =
      case format do
        "webp" -> [".webp"]
        "jpg" -> [".jpg", ".jpeg"]
        "png" -> [".png"]
        _ -> [".png", ".jpg", ".jpeg", ".webp"]
      end

    output_dir
    |> File.ls!()
    |> Enum.filter(fn file ->
      Enum.any?(extensions, &String.ends_with?(file, &1))
    end)
    |> length()
  end
end
