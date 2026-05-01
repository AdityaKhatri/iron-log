import { useEffect, useState } from 'react';
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
import type { ViewId } from './types';

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

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const [onboardingDone, setOnboardingDoneState] = useState<boolean | null>(null);
  const [view, setView] = useState<ViewId>('today');

  useEffect(() => {
    getOnboardingDone().then(done => setOnboardingDoneState(done));
  }, []);

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
        <BottomNav current={navView} onChange={setView} />
      </ActiveSessionProvider>
    </SyncProvider>
  );
}

export default App;
