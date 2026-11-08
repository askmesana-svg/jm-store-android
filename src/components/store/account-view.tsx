import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authErrorText } from "@/lib/store/api";
import { useStore } from "@/lib/store/store";

type Mode = "signin" | "signup";

export function AccountView() {
  const session = useStore((s) => s.session);
  const profile = useStore((s) => s.profile);
  const signIn = useStore((s) => s.signIn);
  const signUp = useStore((s) => s.signUp);
  const signOut = useStore((s) => s.signOut);
  const saveProfile = useStore((s) => s.saveProfile);
  const setScreen = useStore((s) => s.setScreen);

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editPhone, setEditPhone] = useState(profile.phone);
  const [photoNote, setPhotoNote] = useState("");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!session) {
    return (
      <div className="px-4 py-6">
        <p className="text-xs font-semibold tracking-widest text-brick uppercase">Account</p>
        <h2 className="mt-1 font-display text-3xl font-semibold text-balance">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h2>
        <p className="mt-2 text-sm text-pretty text-ink/70">
          {mode === "signin"
            ? "Welcome back. This is the same JM-Store account as the website."
            : "Sign up to keep your cart, wishlist, and details on this phone and the website."}
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            if (!email.trim() || !password) {
              setError("Please fill in your email and password.");
              return;
            }
            if (mode === "signup" && (!name.trim() || !phone.trim())) {
              setError("Please fill in your name and phone number.");
              return;
            }
            setBusy(true);
            const task =
              mode === "signin"
                ? signIn(email, password)
                : signUp({ name, phone, email, password });
            void task
              .then(() => {
                toast.success(mode === "signin" ? "You're logged in" : "You're signed up and logged in");
                setPassword("");
              })
              .catch((err: unknown) => {
                const code = err instanceof Error ? err.message : "";
                setError(authErrorText(code));
              })
              .finally(() => setBusy(false));
          }}
        >
          {mode === "signup" && (
            <>
              <Field label="Full name" value={name} onChange={setName} placeholder="e.g. Ahmed Raza" />
              <Field label="Phone number" value={phone} onChange={setPhone} placeholder="03xx-xxxxxxx" />
            </>
          )}
          <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
          <Field label="Password" value={password} onChange={setPassword} placeholder="At least 6 characters" type="password" />
          {error && <p className="text-sm text-brick">{error}</p>}
          <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-teal font-medium text-ivory disabled:opacity-60">
            {mode === "signin" ? "Sign in" : "Sign up"}
          </button>
          <button
            type="button"
            className="h-12 w-full rounded-xl border border-ink font-medium"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
            }}
          >
            {mode === "signin" ? "Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
        <InstallCard installEvent={installEvent} />
      </div>
    );
  }

  const initial = (profile.name || profile.email || "?").charAt(0).toUpperCase();

  return (
    <div className="px-4 py-6">
      <p className="text-xs font-semibold tracking-widest text-brick uppercase">Your profile</p>
      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="relative">
          {profile.photoURL ? (
            <img src={profile.photoURL} alt="" className="size-24 rounded-full object-cover" />
          ) : (
            <div className="flex size-24 items-center justify-center rounded-full bg-ink font-display text-3xl text-ivory">{initial}</div>
          )}
          <label className="absolute right-0 bottom-0 flex size-9 cursor-pointer items-center justify-center rounded-full bg-ink text-xs text-ivory">
            Edit
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (!file.type.startsWith("image/")) {
                  setPhotoNote("Please choose an image file.");
                  return;
                }
                setPhotoNote("Uploading…");
                void compressImage(file)
                  .then((photoURL) => saveProfile({ name: profile.name || editName, phone: profile.phone, photoURL }))
                  .then(() => setPhotoNote("Photo updated"))
                  .catch(() => setPhotoNote("Could not upload photo. Try a smaller image."));
              }}
            />
          </label>
        </div>
        {photoNote && <p className="text-xs text-ink/70">{photoNote}</p>}
      </div>
      <div className="mt-5 space-y-3">
        <Field label="Full name" value={editing ? editName : profile.name} onChange={setEditName} disabled={!editing} />
        <Field label="Phone number" value={editing ? editPhone : profile.phone} onChange={setEditPhone} disabled={!editing} />
        <Field label="Email" value={profile.email} onChange={() => undefined} disabled />
      </div>
      <div className="mt-4 space-y-2">
        {!editing ? (
          <button
            type="button"
            className="h-12 w-full rounded-xl border border-ink font-medium"
            onClick={() => {
              setEditName(profile.name);
              setEditPhone(profile.phone);
              setEditing(true);
            }}
          >
            Edit details
          </button>
        ) : (
          <button
            type="button"
            className="h-12 w-full rounded-xl bg-teal font-medium text-ivory"
            onClick={() => {
              if (!editName.trim()) {
                toast.error("Name can't be empty.");
                return;
              }
              setBusy(true);
              void saveProfile({ name: editName, phone: editPhone })
                .then(() => {
                  toast.success("Profile updated");
                  setEditing(false);
                })
                .catch(() => toast.error("Could not save changes. Try again."))
                .finally(() => setBusy(false));
            }}
          >
            Save changes
          </button>
        )}
        <button
          type="button"
          className="h-12 w-full rounded-xl border border-ink font-medium"
          onClick={() => {
            signOut();
            toast.success("You're logged out");
          }}
        >
          Log out
        </button>
        <button type="button" onClick={() => setScreen("track")} className="h-12 w-full rounded-xl border border-line font-medium">
          Track an order
        </button>
        <button type="button" onClick={() => setScreen("help")} className="h-12 w-full rounded-xl border border-line font-medium">
          Help, size guide & policy
        </button>
      </div>
      <InstallCard installEvent={installEvent} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-12 w-full rounded-xl border border-line bg-surface px-3 font-normal outline-none focus:border-teal disabled:opacity-60"
      />
    </label>
  );
}

function InstallCard({ installEvent }: { installEvent: BeforeInstallPromptEvent | null }) {
  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-display text-xl font-semibold">Install on Android</h3>
      <p className="mt-1 text-sm text-pretty text-ink/75">
        Add JM-Store to your home screen and it opens full screen, like an app — catalogue, cart, wishlist, and WhatsApp orders included.
      </p>
      {installEvent ? (
        <button
          type="button"
          className="mt-3 h-11 rounded-xl bg-teal px-4 text-sm font-medium text-ivory"
          onClick={() => void installEvent.prompt()}
        >
          Install app
        </button>
      ) : (
        <p className="mt-3 text-sm text-ink/70">
          In Chrome, open the menu and tap Install app or Add to Home screen.
        </p>
      )}
    </section>
  );
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

function compressImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image"));
      img.onload = () => {
        const maxDim = 280;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
