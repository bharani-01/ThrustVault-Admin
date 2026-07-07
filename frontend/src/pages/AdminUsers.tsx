import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Database, Shield, User, Info, PlusCircle, X, Trash2, Key, Search, Filter } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  created_at: string;
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add user modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user' | 'guest'>('user');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user' | 'guest'>('all');

  // Edit/Action states
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newRole, setNewRole] = useState<'admin' | 'user' | 'guest'>('user');
  const [newPassword, setNewPassword] = useState('');
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/user-profiles');
      if (!res.ok) throw new Error('Failed to fetch user profiles');
      const data = await res.json();
      setUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !role) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user account.');

      setIsAddModalOpen(false);
      setEmail('');
      setPassword('');
      setRole('user');
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete the user account "${email}"?`)) return;
    try {
      const res = await fetch(`/api/user-profiles/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user.');
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEditRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/user-profiles/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user role.');
      setIsEditModalOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !newPassword) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/user-profiles/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password.');
      setIsResetPasswordOpen(false);
      setNewPassword('');
      setEditingUser(null);
      alert('Password reset successfully.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // filter users in-memory
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  return (
    <Layout>
      <main className="flex-1 flex flex-col px-4 md:px-12 py-6 max-w-[1200px] w-full mx-auto relative z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-200/50 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300">
                Admin Console
              </span>
              <span className="text-xs text-slate-400 font-medium">User Management</span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#001e40] dark:text-slate-100 tracking-tight">
              Console Access Accounts
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              Manage accounts, reset passwords, and modify role policies for powertrain databases.
            </p>
          </div>
          <div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold py-2.5 px-4 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Add User Account
            </button>
          </div>
        </header>

        {/* Search & Filter Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search user email address..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-850 rounded-lg h-[34px] pl-9 pr-4 text-xs font-semibold focus:outline-none focus:border-[#003366] dark:text-slate-100"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-850 rounded-lg px-3 h-[34px] text-xs">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value as any)}
                className="bg-transparent font-semibold focus:outline-none border-none cursor-pointer dark:text-slate-100 py-0"
              >
                <option value="all" className="dark:bg-slate-900">All Roles</option>
                <option value="admin" className="dark:bg-slate-900">Admin</option>
                <option value="user" className="dark:bg-slate-900">User</option>
                <option value="guest" className="dark:bg-slate-900">Guest</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl p-5">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-mono uppercase tracking-wider">
                  <th className="py-3 px-3">Profile Account</th>
                  <th className="py-3 px-3">Assigned Role</th>
                  <th className="py-3 px-3">Created On</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-3"><div className="h-4 w-44 bg-slate-200 rounded"></div></td>
                      <td className="py-4 px-3"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                      <td className="py-4 px-3"><div className="h-4 w-28 bg-slate-200 rounded"></div></td>
                      <td className="py-4 px-3"><div className="h-4 w-20 bg-slate-200 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      <Info className="w-6 h-6 mx-auto mb-2" />
                      No registered user accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/10">
                      <td className="py-3.5 px-3 font-semibold flex items-center gap-2 text-[#001e40] dark:text-slate-100">
                        <User className="w-4 h-4 text-slate-400" />
                        {u.email}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin' 
                            ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300' 
                            : u.role === 'guest'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350'
                            : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-slate-450 dark:text-slate-400 font-mono">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button 
                            onClick={() => {
                              setEditingUser(u);
                              setNewRole(u.role);
                              setIsEditModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Edit Role"
                          >
                            <Shield className="w-3.5 h-3.5" /> Role
                          </button>
                          <button 
                            onClick={() => {
                              setEditingUser(u);
                              setIsResetPasswordOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Reset Password"
                          >
                            <Key className="w-3.5 h-3.5" /> Reset
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-extrabold text-[#001e40] dark:text-slate-100 mb-2">Create New Account</h3>
            <p className="text-xs text-slate-550 dark:text-slate-400 mb-5 font-semibold">Provide login credentials and designate a catalog access role.</p>

            <form onSubmit={handleAddUserSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider font-mono mb-2">Email Address</label>
                <input 
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@thrustvault.com"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl py-2.5 px-3 text-xs font-semibold focus:outline-none focus:border-[#003366] dark:text-slate-100"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider font-mono mb-2">Access Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl py-2.5 px-3 text-xs font-semibold focus:outline-none focus:border-[#003366] dark:text-slate-100"
                >
                  <option value="user" className="dark:bg-slate-950">User (Standard Dashboard)</option>
                  <option value="admin" className="dark:bg-slate-950">Admin (Console Controls)</option>
                  <option value="guest" className="dark:bg-slate-950">Guest (Read-Only)</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider font-mono mb-2">Initial Password</label>
                <input 
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl py-2.5 px-3 text-xs font-semibold focus:outline-none focus:border-[#003366] dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingUser(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-extrabold text-[#001e40] dark:text-slate-100 mb-2">Modify Access Role</h3>
            <p className="text-xs text-slate-550 dark:text-slate-400 mb-5 font-semibold">Change permissions level for account <strong>{editingUser.email}</strong>.</p>

            <form onSubmit={handleEditRoleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider font-mono mb-2">Access Role</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl py-2.5 px-3 text-xs font-semibold focus:outline-none focus:border-[#003366] dark:text-slate-100"
                >
                  <option value="user" className="dark:bg-slate-950">User (Standard Dashboard)</option>
                  <option value="admin" className="dark:bg-slate-950">Admin (Console Controls)</option>
                  <option value="guest" className="dark:bg-slate-950">Guest (Read-Only)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Updating...' : 'Update Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPasswordOpen && editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => {
                setIsResetPasswordOpen(false);
                setEditingUser(null);
                setNewPassword('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-extrabold text-[#001e40] dark:text-slate-100 mb-2">Reset Account Password</h3>
            <p className="text-xs text-slate-550 dark:text-slate-400 mb-5 font-semibold">Set a new password for account <strong>{editingUser.email}</strong>.</p>

            <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider font-mono mb-2">New Password</label>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl py-2.5 px-3 text-xs font-semibold focus:outline-none focus:border-[#003366] dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button"
                  onClick={() => {
                    setIsResetPasswordOpen(false);
                    setEditingUser(null);
                    setNewPassword('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};
