'use client';
import ProtectedLayout from '@/components/ProtectedLayout';

export default function AutoEmailLayout({ children }) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
