import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Shield, UserCheck, X, Check, Info, Trash2, Search, Filter } from 'lucide-react';

interface AccessRequest {
  id: string;
  full_name: string;
  email: string;
  justification: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export const AdminAccessRequests: React.FC = () => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [autoApprove, setAutoApprove] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setAutoApprove(!!data.auto_approve);
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  const toggleAutoApprove = async () => {
    const nextVal = !autoApprove;
    setAutoApprove(nextVal);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'auto_approve', value: nextVal })
      });
      if (!res.ok) throw new Error('Failed to update settings');
    } catch (err) {
      setAutoApprove(!nextVal); // rollback
      console.error(err);
    }
  };

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/db/access_requests?order=created_at.desc');
      if (!res.ok) throw new Error('Failed to load access requests');
      const data = await res.json();
      setRequests(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchSettings();
  }, []);

  const handleAction = async (id: string, email: string, status: 'approved' | 'rejected') => {
    if (!window.confirm(`Mark access request from "${email}" as ${status}?`)) return;

    try {
      const res = await fetch(`/api/admin/access-requests/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update request');
      
      fetchRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteRequest = async (id: string, email: string) => {
    if (!window.confirm(`Permanently delete the access request from "${email}"?`)) return;
    try {
      const res = await fetch(`/api/db/access_requests/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete request');
      fetchRequests();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // filter requests in-memory
  const filteredRequests = requests.filter(r => {
    const matchesSearch = (r.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (r.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
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
              <span className="text-xs text-slate-400 font-medium">Access Requests</span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#001e40] dark:text-slate-100 tracking-tight">
              Access Request Applications
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              Approve, deny, or clean up UAV console account registration requests.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl px-4 py-2.5 shadow-sm">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Auto Approve Requests
            </span>
            <button
              onClick={toggleAutoApprove}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                autoApprove ? 'bg-[#003366] dark:bg-blue-600' : 'bg-slate-200 dark:bg-slate-850'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  autoApprove ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </header>

        {/* Search & Filter Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search applicant name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-850 rounded-lg h-[34px] pl-9 pr-4 text-xs font-semibold focus:outline-none focus:border-[#003366] dark:text-slate-100"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-850 rounded-lg px-3 h-[34px] text-xs">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="bg-transparent font-semibold focus:outline-none border-none cursor-pointer dark:text-slate-100 py-0"
              >
                <option value="all" className="dark:bg-slate-900">All Statuses</option>
                <option value="pending" className="dark:bg-slate-900">Pending</option>
                <option value="approved" className="dark:bg-slate-900">Approved</option>
                <option value="rejected" className="dark:bg-slate-900">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl p-5">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-mono uppercase tracking-wider">
                  <th className="py-3 px-3">Applicant Name</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Justifications / Purpose</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-3"><div className="h-4 w-28 bg-slate-200 rounded"></div></td>
                      <td className="py-4 px-3"><div className="h-4 w-32 bg-slate-200 rounded"></div></td>
                      <td className="py-4 px-3"><div className="h-4 w-48 bg-slate-200 rounded"></div></td>
                      <td className="py-4 px-3"><div className="h-4 w-12 bg-slate-200 rounded"></div></td>
                      <td className="py-4 px-3"><div className="h-4 w-20 bg-slate-200 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      <Info className="w-6 h-6 mx-auto mb-2" />
                      No access request records.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/10">
                      <td className="py-3.5 px-3 font-semibold text-[#001e40] dark:text-slate-100">{r.full_name}</td>
                      <td className="py-3.5 px-3 font-semibold">{r.email}</td>
                      <td className="py-3.5 px-3 text-slate-500 dark:text-slate-400 text-xs max-w-xs truncate" title={r.justification}>
                        {r.justification}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          r.status === 'approved' ? 'bg-emerald-150 text-emerald-800' :
                          r.status === 'rejected' ? 'bg-rose-150 text-rose-800' :
                          'bg-amber-150 text-amber-800'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleAction(r.id, r.email, 'approved')}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded cursor-pointer transition-colors"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleAction(r.id, r.email, 'rejected')}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded cursor-pointer transition-colors"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => handleDeleteRequest(r.id, r.email)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded cursor-pointer transition-colors"
                            title="Delete Request"
                          >
                            <Trash2 className="w-4 h-4" />
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
    </Layout>
  );
};
