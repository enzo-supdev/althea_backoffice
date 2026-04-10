import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Connexion | Althea Systems',
  description: 'Connectez-vous à votre compte Althea Systems Backoffice',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Althea Systems</h1>
          <p className="mt-2 text-gray-600">Backoffice</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connexion</h2>
          <p className="text-gray-600 text-sm mb-8">
            Entrez vos identifiants pour accéder au backoffice
          </p>

          <LoginForm />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>&copy; 2024 Althea Systems. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  );
}
