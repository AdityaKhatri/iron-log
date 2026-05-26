import { useEffect, useState } from 'react';
import { useActiveSession } from './context/ActiveSessionContext';
import { BottomNav } from './components/BottomNav/BottomNav';
import { TodayView } from './views/Today/TodayView';
import { PlanView } from './views/Plan/PlanView';
import { WorkoutsView } from './views/Workouts/WorkoutsView';
import { ExercisesView } from './views/Exercises/ExercisesView';
import { ProfileView } from './views/Profile/ProfileView';
import { ExerciseEditorView } from './views/ExerciseEditor/ExerciseEditorView';
import { OnboardingView } from './views/Onboarding/OnboardingView';
import { ActiveSessionProvider } from './context/ActiveSessionContext';
import { SyncProvider } from './context/SyncContext';
import { LogoFull } from './components/Logo/Logo';
import { getOnboardingDone, setOnboardingDone } from './db/meta';
import { syncLibraryFromGitHub, getLibraryLastSynced } from './lib/library';
import {
  decodeWorkoutPayload, previewImport,
  extractImportFragment, clearImportFragment,
} from './lib/share';
import type { SharePayload, ImportPreview } from './lib/share';
import { ImportSheet } from './components/ImportSheet/ImportSheet';
import type { ViewId } from './types';

// ─── Conditional Nav ─────────────────────────────────────────────────────────

function ConditionalNav({ current, onChange }: { current: ViewId; onChange: (v: ViewId) => void }) {
  const { session, paused } = useActiveSession();
  if (session && !paused) return null;
  return <BottomNav current={current} onChange={onChange} />;
}

// ─── Splash screen ────────────────────────────────────────────────────────────

function SplashScreen() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      zIndex: 300,
    }}>
      <LogoFull markSize={50} />
    </div>
  );
}

// ─── SW update detection ──────────────────────────────────────────────────────

function useUpdatePrompt() {
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return;

      // Already a waiting SW when we open (e.g. user had the tab open during deploy)
      if (reg.waiting) setWaitingSW(reg.waiting);

      // New SW finishes installing while the app is open
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingSW(newSW);
          }
        });
      });
    });

    // When skipWaiting completes the controller changes — reload to pick up new assets
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  }, []);

  function applyUpdate() {
    if (!waitingSW) return;
    waitingSW.postMessage({ type: 'SKIP_WAITING' });
  }

  return { updateAvailable: !!waitingSW, applyUpdate };
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const { updateAvailable, applyUpdate } = useUpdatePrompt();
  const [onboardingDone, setOnboardingDoneState] = useState<boolean | null>(null);
  const [view, setView] = useState<ViewId>('today');
  const [importState, setImportState] = useState<{
    payload: SharePayload;
    preview: ImportPreview;
  } | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  useEffect(() => {
    getOnboardingDone().then(done => setOnboardingDoneState(done));
  }, []);

  // Detect #import= fragment and prepare the confirmation sheet
  useEffect(() => {
    const encoded = extractImportFragment();
    if (!encoded) return;
    clearImportFragment();
    decodeWorkoutPayload(encoded)
      .then(payload => previewImport(payload).then(preview => setImportState({ payload, preview })))
      .catch(() => {/* invalid link — silently ignore */});
  }, []);

  // Auto-sync library from GitHub on every app launch.
  // On first launch (never synced): runs immediately so exercises/videos are available.
  // On subsequent launches: runs silently in the background so video URLs stay fresh.
  useEffect(() => {
    if (!onboardingDone) return;
    getLibraryLastSynced().then(lastSynced => {
      // Always sync: first-time or to pick up video/exercise updates from GitHub
      syncLibraryFromGitHub().catch(() => {
        // Network unavailable — not an error, user is offline
      });
      void lastSynced; // used only to decide priority; sync always runs
    });
  }, [onboardingDone]);

  async function handleOnboardingDone() {
    await setOnboardingDone();
    setOnboardingDoneState(true);
  }

  if (onboardingDone === null) {
    return <SplashScreen />;
  }

  if (!onboardingDone) {
    return (
      <SyncProvider>
        <OnboardingView onDone={handleOnboardingDone} />
      </SyncProvider>
    );
  }

  // Editor is an overlay — keep the previous view so the nav tab stays correct.
  const navView: ViewId = view === 'editor' ? 'library' : view;

  return (
    <SyncProvider>
      <ActiveSessionProvider>
        <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {view === 'today'    && <TodayView />}
          {view === 'plan'     && <PlanView />}
          {view === 'workouts' && <WorkoutsView />}
          {view === 'library'  && <ExercisesView onOpenEditor={() => setView('editor')} />}
          {view === 'profile'  && <ProfileView />}
          {view === 'editor'   && <ExerciseEditorView onBack={() => setView('library')} />}
        </main>
        <ConditionalNav current={navView} onChange={setView} />

        {/* Update available banner */}
        {updateAvailable && (
          <div style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 0px)',
            left: 0, right: 0,
            background: 'var(--accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            zIndex: 500,
          }}>
            <span>New version available</span>
            <button
              onClick={applyUpdate}
              style={{
                background: '#fff',
                color: 'var(--accent)',
                border: 'none',
                borderRadius: 3,
                padding: '4px 10px',
                fontFamily: 'var(--mono)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                cursor: 'pointer',
              }}
            >
              REFRESH
            </button>
          </div>
        )}

        {/* Import confirmation sheet */}
        {importState && (
          <ImportSheet
            payload={importState.payload}
            preview={importState.preview}
            onDone={name => {
              setImportState(null);
              setImportSuccess(name);
              setView('workouts');
              setTimeout(() => setImportSuccess(null), 4000);
            }}
            onCancel={() => setImportState(null)}
          />
        )}

        {/* Import success toast */}
        {importSuccess && (
          <div style={{
            position: 'fixed',
            bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            left: 16, right: 16,
            background: 'var(--grp-cardio)',
            color: '#fff',
            borderRadius: 4,
            padding: '10px 14px',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            "{importSuccess}" added to Workouts
          </div>
        )}
      </ActiveSessionProvider>
    </SyncProvider>
  );
}

export default App;
