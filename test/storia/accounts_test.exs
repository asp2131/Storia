defmodule Storia.AccountsTest do
  use Storia.DataCase

  alias Storia.Accounts
  alias Storia.Accounts.User

  describe "register_user/1" do
    test "registers user with valid data" do
      valid_attrs = %{
        email: "test@example.com",
        password: "Password123"
      }

      assert {:ok, %User{} = user} = Accounts.register_user(valid_attrs)
      assert user.email == "test@example.com"
      assert user.subscription_tier == :free
      assert user.role == :user
      assert is_binary(user.password_hash)
    end

    test "requires email and password" do
      assert {:error, changeset} = Accounts.register_user(%{})
      assert %{email: ["can't be blank"], password: ["can't be blank"]} = errors_on(changeset)
    end

    test "validates email format" do
      invalid_attrs = %{email: "invalid", password: "Password123"}
      assert {:error, changeset} = Accounts.register_user(invalid_attrs)
      assert %{email: ["must have the @ sign and no spaces"]} = errors_on(changeset)
    end

    test "validates password length" do
      short_password = %{email: "test@example.com", password: "Pass1"}
      assert {:error, changeset} = Accounts.register_user(short_password)
      assert %{password: ["should be at least 8 character(s)"]} = errors_on(changeset)
    end

    test "validates password complexity - requires uppercase" do
      no_uppercase = %{email: "test@example.com", password: "password123"}
      assert {:error, changeset} = Accounts.register_user(no_uppercase)
      assert %{password: ["must contain at least one uppercase letter"]} = errors_on(changeset)
    end

    test "validates password complexity - requires lowercase" do
      no_lowercase = %{email: "test@example.com", password: "PASSWORD123"}
      assert {:error, changeset} = Accounts.register_user(no_lowercase)
      assert %{password: ["must contain at least one lowercase letter"]} = errors_on(changeset)
    end

    test "validates password complexity - requires number" do
      no_number = %{email: "test@example.com", password: "PasswordABC"}
      assert {:error, changeset} = Accounts.register_user(no_number)
      assert %{password: ["must contain at least one number"]} = errors_on(changeset)
    end

    test "validates unique email" do
      valid_attrs = %{email: "test@example.com", password: "Password123"}
      assert {:ok, _user} = Accounts.register_user(valid_attrs)
      assert {:error, changeset} = Accounts.register_user(valid_attrs)
      assert %{email: ["has already been taken"]} = errors_on(changeset)
    end

    test "hashes password" do
      valid_attrs = %{email: "test@example.com", password: "Password123"}
      assert {:ok, user} = Accounts.register_user(valid_attrs)
      assert user.password_hash != "Password123"
      assert is_binary(user.password_hash)
    end
  end

  describe "authenticate_user/2" do
    setup do
      {:ok, user} = Accounts.register_user(%{
        email: "test@example.com",
        password: "Password123"
      })
      %{user: user}
    end

    test "authenticates user with valid credentials", %{user: user} do
      assert {:ok, authenticated_user} = Accounts.authenticate_user("test@example.com", "Password123")
      assert authenticated_user.id == user.id
    end

    test "returns error with invalid password" do
      assert {:error, :invalid_credentials} = Accounts.authenticate_user("test@example.com", "WrongPassword")
    end

    test "returns error with non-existent email" do
      assert {:error, :invalid_credentials} = Accounts.authenticate_user("nonexistent@example.com", "Password123")
    end
  end

  describe "get_user_by_email/1" do
    test "returns user when email exists" do
      {:ok, user} = Accounts.register_user(%{
        email: "test@example.com",
        password: "Password123"
      })

      found_user = Accounts.get_user_by_email("test@example.com")
      assert found_user.id == user.id
    end

    test "returns nil when email does not exist" do
      assert Accounts.get_user_by_email("nonexistent@example.com") == nil
    end
  end

  describe "generate_reset_token/1 and reset_password/2" do
    setup do
      {:ok, user} = Accounts.register_user(%{
        email: "test@example.com",
        password: "Password123"
      })
      %{user: user}
    end

    test "generates reset token for user", %{user: user} do
      token = Accounts.generate_reset_token(user)
      assert is_binary(token)
      assert byte_size(token) > 0
    end

    test "resets password with valid token", %{user: user} do
      token = Accounts.generate_reset_token(user)
      reset_user = Accounts.get_user_by_reset_password_token(token)

      assert {:ok, updated_user} = Accounts.reset_password(reset_user, %{
        password: "NewPassword456"
      })

      # Old password should not work
      assert {:error, :invalid_credentials} = Accounts.authenticate_user("test@example.com", "Password123")

      # New password should work
      assert {:ok, _} = Accounts.authenticate_user("test@example.com", "NewPassword456")
    end

    test "validates new password complexity", %{user: user} do
      token = Accounts.generate_reset_token(user)
      reset_user = Accounts.get_user_by_reset_password_token(token)

      assert {:error, changeset} = Accounts.reset_password(reset_user, %{password: "short"})
      assert %{password: _errors} = errors_on(changeset)
    end
  end

  describe "update_subscription/3" do
    setup do
      {:ok, user} = Accounts.register_user(%{
        email: "test@example.com",
        password: "Password123"
      })
      %{user: user}
    end

    test "updates user subscription tier", %{user: user} do
      assert {:ok, updated_user} = Accounts.update_subscription(user, :reader, "active")
      assert updated_user.subscription_tier == :reader
      assert updated_user.subscription_status == "active"
    end

    test "updates to bibliophile tier", %{user: user} do
      assert {:ok, updated_user} = Accounts.update_subscription(user, :bibliophile, "active")
      assert updated_user.subscription_tier == :bibliophile
    end
  end

  describe "admin?/1" do
    test "returns true for admin user" do
      {:ok, user} = Accounts.register_user(%{
        email: "admin@example.com",
        password: "Password123"
      })

      # Manually update role to admin
      user = Repo.update!(Ecto.Changeset.change(user, role: :admin))

      assert Accounts.admin?(user) == true
    end

    test "returns false for regular user" do
      {:ok, user} = Accounts.register_user(%{
        email: "user@example.com",
        password: "Password123"
      })

      assert Accounts.admin?(user) == false
    end
  end
end
