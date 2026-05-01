import { useState } from 'react';
import { BottomNav } from './components/BottomNav/BottomNav';
import { TodayView } from './views/Today/TodayView';
import { PlanView } from './views/Plan/PlanView';
import { WorkoutsView } from './views/Workouts/WorkoutsView';
import { ExercisesView } from './views/Exercises/ExercisesView';
import { ProfileView } from './views/Profile/ProfileView';
import { ExerciseEditorView } from './views/ExerciseEditor/ExerciseEditorView';
import type { ViewId } from './types';

export function App() {
  const [view, setView] = useState<ViewId>('today');

  // Editor is an overlay — keep the previous view so the nav tab stays correct.
  const navView: ViewId = view === 'editor' ? 'library' : view;

  return (
    <>
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'today'    && <TodayView />}
        {view === 'plan'     && <PlanView />}
        {view === 'workouts' && <WorkoutsView />}
        {view === 'library'  && <ExercisesView onOpenEditor={() => setView('editor')} />}
        {view === 'profile'  && <ProfileView />}
        {view === 'editor'   && <ExerciseEditorView onBack={() => setView('library')} />}
      </main>
      <BottomNav current={navView} onChange={setView} />
    </>
  );
}

export default App;
