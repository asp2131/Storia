"use client";

import { ReactNode } from "react";

interface AuthFormProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
}

export function AuthForm({ title, subtitle, children, onSubmit }: AuthFormProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-center text-sm text-gray-600">
              {subtitle}
            </p>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={onSubmit}>
          {children}
        </form>
      </div>
    </div>
  );
}
