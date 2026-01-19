defmodule Storia.Accounts do
  @moduledoc """
  The Accounts context.
  """

  import Ecto.Query, warn: false
  alias Storia.Repo
  alias Storia.Accounts.{User, UserToken, UserNotifier}

  ## User registration

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking user changes.

  ## Examples

      iex> change_user_registration(user)
      %Ecto.Changeset{data: %User{}}

  """
  def change_user_registration(%User{} = user, attrs \\ %{}) do
    User.registration_changeset(user, attrs, hash_password: false, validate_email: false)
  end

  @doc """
  Registers a user.

  ## Examples

      iex> register_user(%{email: "user@example.com", password: "Password123"})
      {:ok, %User{}}

      iex> register_user(%{email: "invalid", password: "short"})
      {:error, %Ecto.Changeset{}}

  """
  def register_user(attrs) do
    %User{}
    |> User.registration_changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Delivers the confirmation email instructions.
  """
  def deliver_user_confirmation_instructions(%User{} = user, confirmation_url_fun)
      when is_function(confirmation_url_fun, 1) do
    {token, user_token} = UserToken.build_email_token(user, "confirm")
    Repo.insert!(user_token)
    UserNotifier.deliver_confirmation_instructions(user, confirmation_url_fun.(token))
  end

  @doc """
  Delivers the reset password email instructions.
  """
  def deliver_user_reset_password_instructions(%User{} = user, reset_url_fun)
      when is_function(reset_url_fun, 1) do
    {token, user_token} = UserToken.build_email_token(user, "reset_password")
    Repo.insert!(user_token)
    UserNotifier.deliver_reset_password_instructions(user, reset_url_fun.(token))
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for changing the user password.

  ## Examples

      iex> change_user_password(user)
      %Ecto.Changeset{data: %User{}}

  """
  def change_user_password(user, attrs \\ %{}) do
    User.password_changeset(user, attrs, hash_password: false)
  end

  ## User authentication

  @doc """
  Authenticates a user by email and password.

  ## Examples

      iex> authenticate_user("user@example.com", "Password123")
      {:ok, %User{}}

      iex> authenticate_user("user@example.com", "wrong_password")
      {:error, :invalid_credentials}

  """
  def authenticate_user(email, password) when is_binary(email) and is_binary(password) do
    user = Repo.get_by(User, email: email)

    if User.valid_password?(user, password) do
      {:ok, user}
    else
      {:error, :invalid_credentials}
    end
  end

  @doc """
  Gets a user by email.

  ## Examples

      iex> get_user_by_email("user@example.com")
      %User{}

      iex> get_user_by_email("unknown@example.com")
      nil

  """
  def get_user_by_email(email) when is_binary(email) do
    Repo.get_by(User, email: email)
  end

  @doc """
  Gets a user by email and password.

  ## Examples

      iex> get_user_by_email_and_password("user@example.com", "Password123")
      %User{}

      iex> get_user_by_email_and_password("user@example.com", "wrong")
      nil

  """
  def get_user_by_email_and_password(email, password)
      when is_binary(email) and is_binary(password) do
    user = Repo.get_by(User, email: email)
    if User.valid_password?(user, password), do: user
  end

  @doc """
  Gets a single user.

  Raises `Ecto.NoResultsError` if the User does not exist.

  ## Examples

      iex> get_user!(123)
      %User{}

      iex> get_user!(456)
      ** (Ecto.NoResultsError)

  """
  def get_user!(id), do: Repo.get!(User, id)

  @doc """
  Gets a user by id or returns nil.
  """
  def get_user_by_id(id), do: Repo.get(User, id)

  ## Password reset

  @doc """
  Generates a password reset token for a user.

  ## Examples

      iex> generate_reset_token(user)
      "abc123def456"

  """
  def generate_reset_token(%User{} = user) do
    {token, user_token} = UserToken.build_email_token(user, "reset_password")
    Repo.insert!(user_token)
    token
  end

  @doc """
  Gets the user with the given signed token.
  """
  def get_user_by_reset_password_token(token) do
    with {:ok, query} <- UserToken.verify_email_token_query(token, "reset_password"),
         %User{} = user <- Repo.one(query) do
      user
    else
      _ -> nil
    end
  end

  @doc """
  Resets the user password.

  ## Examples

      iex> reset_password(user, %{password: "NewPassword123"})
      {:ok, %User{}}

      iex> reset_password(user, %{password: "short"})
      {:error, %Ecto.Changeset{}}

  """
  def reset_password(user, attrs) do
    Ecto.Multi.new()
    |> Ecto.Multi.update(:user, User.password_changeset(user, attrs))
    |> Ecto.Multi.delete_all(:tokens, UserToken.by_user_and_contexts_query(user, ["reset_password"]))
    |> Repo.transaction()
    |> case do
      {:ok, %{user: user}} -> {:ok, user}
      {:error, :user, changeset, _} -> {:error, changeset}
    end
  end

  @doc """
  Updates the user password.

  ## Examples

      iex> update_user_password(user, "Password123", %{password: "NewPassword456"})
      {:ok, %User{}}

      iex> update_user_password(user, "wrong", %{password: "NewPassword456"})
      {:error, %Ecto.Changeset{}}

  """
  def update_user_password(user, password, attrs) do
    changeset =
      user
      |> User.password_changeset(attrs)
      |> User.validate_current_password(password)

    Ecto.Multi.new()
    |> Ecto.Multi.update(:user, changeset)
    |> Ecto.Multi.delete_all(:tokens, UserToken.by_user_and_contexts_query(user, :all))
    |> Repo.transaction()
    |> case do
      {:ok, %{user: user}} -> {:ok, user}
      {:error, :user, changeset, _} -> {:error, changeset}
    end
  end

  ## Session

  @doc """
  Generates a session token.
  """
  def generate_user_session_token(user) do
    {token, user_token} = UserToken.build_session_token(user)
    Repo.insert!(user_token)
    token
  end

  @doc """
  Gets the user with the given signed token.
  """
  def get_user_by_session_token(token) do
    {:ok, query} = UserToken.verify_session_token_query(token)
    Repo.one(query)
  end

  @doc """
  Deletes the signed token with the given context.
  """
  def delete_user_session_token(token) do
    Repo.delete_all(UserToken.by_token_and_context_query(token, "session"))
    :ok
  end

  ## Subscription management

  @doc """
  Updates a user's subscription tier.

  ## Examples

      iex> update_subscription(user, :reader, "active")
      {:ok, %User{}}

  """
  def update_subscription(user, tier, status) when tier in [:free, :reader, :bibliophile] do
    user
    |> Ecto.Changeset.change(%{
      subscription_tier: tier,
      subscription_status: status
    })
    |> Repo.update()
  end

  @doc """
  Checks if a user has admin role.

  ## Examples

      iex> admin?(user)
      true

  """
  def admin?(%User{role: :admin}), do: true
  def admin?(_), do: false

  @doc """
  Updates a user's role.

  ## Examples

      iex> update_user_role(user, :admin)
      {:ok, %User{}}

  """
  def update_user_role(%User{} = user, role) when role in [:user, :admin] do
    user
    |> Ecto.Changeset.change(%{role: role})
    |> Repo.update()
  end
end
