import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata = {
  title: 'Inscription | Althea Systems',
  description: 'Créez votre compte Althea Systems Backoffice',
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Althea Systems</h1>
          <p className="mt-2 text-gray-600">Backoffice</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Inscription</h2>
          <p className="text-gray-600 text-sm mb-8">
            Créez votre compte pour accéder au backoffice
          </p>

          <RegisterForm />
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>&copy; 2024 Althea Systems. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  );
}
