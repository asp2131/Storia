defmodule Storia.Guardian do
  use Guardian, otp_app: :storia

  alias Storia.Accounts

  def subject_for_token(user, _claims) do
    # You can use any value for the subject of your token but
    # it should be unique.
    {:ok, to_string(user.id)}
  end

  def resource_from_claims(%{"sub" => id}) do
    # Here we'll look up our resource from the claims, the subject can be
    # found in the `"sub"` key. In `above subject_for_token/2` we returned
    # the resource id so here we'll rely on that to look it up.
    user = Accounts.get_user_by_id(id)
    {:ok, user}
  end
end
