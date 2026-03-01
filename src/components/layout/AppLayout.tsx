import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Toaster } from '../ui/Toaster';
import { ErrorBoundary } from '../ErrorBoundary';

export const AppLayout: React.FC = () => {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <div className="min-h-screen bg-bg-deep text-text-primary">
        <Header />
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
        <Toaster />
      </div>
    </ErrorBoundary>
  );
};
