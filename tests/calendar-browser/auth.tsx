export function useAuth() {
  return {
    session: { access_token: "fixture-session" },
    user: {
      id: "fixture-user",
      identities: [
        { provider: "google", identity_data: { sub: "fixture-google-user" } },
      ],
    },
  };
}
