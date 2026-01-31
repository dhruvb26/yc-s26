'use client'

import * as React from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { completeOnboarding } from '@/app/onboarding/_actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function OnboardingComponent() {
  const [error, setError] = React.useState('')
  const { user } = useUser()
  const router = useRouter()

  const handleSubmit = async (formData: FormData) => {
    const res = await completeOnboarding(formData)
    if (res?.message) {
      // Forces a token refresh and refreshes the `User` object
      await user?.reload()
      router.push('/')
    }
    if (res?.error) {
      setError(res?.error)
    }
  }
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Complete your profile to get started
          </p>
        </div>

        <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Application Details</CardTitle>
          <CardDescription>
            Tell us about your application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="applicationName">Application Name</Label>
              <Input
                id="applicationName"
                name="applicationName"
                type="text"
                placeholder="Enter your application name"
                required
              />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Enter the name of your application.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="applicationType">Application Type</Label>
              <Input
                id="applicationType"
                name="applicationType"
                type="text"
                placeholder="e.g., Web App, Mobile App"
                required
              />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Describe the type of your application.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Error: {error}
              </p>
            )}

            <Button type="submit" className="w-full">
              Complete Setup
            </Button>
          </form>
        </CardContent>
        </Card>
      </div>
    </div>
  )
}