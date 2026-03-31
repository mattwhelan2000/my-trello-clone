import { loginAction } from "./actions";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md border border-gray-200">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Secured Access</h1>
        <p className="text-center text-gray-500 mb-6">Enter the password to access the site.</p>
        
        <form action={loginAction} className="space-y-4">
          <div>
            <input
              type="password"
              name="password"
              placeholder="Enter password..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
