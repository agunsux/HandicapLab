import React from 'react';

export default function SettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col min-h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings & Preferences</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, subscription, and notification preferences.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Subscription</h2>
        <div className="flex items-center justify-between py-4 border-b border-border/50">
          <div>
            <p className="font-medium text-foreground">Current Plan</p>
            <p className="text-sm text-muted-foreground">HandicapLab Free Tier</p>
          </div>
          <button className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors">
            Upgrade
          </button>
        </div>
        
        <h2 className="text-lg font-semibold mt-8 mb-4">Account Details</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <input 
              type="email" 
              disabled 
              value="user@example.com" 
              className="bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground max-w-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
