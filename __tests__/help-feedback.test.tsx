// @vitest-environment jsdom
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import HelpPage from '@/app/(app)/help/page'

describe('Help feedback and reports', () => {
  beforeEach(() => fetchMock.mockReset())

  it('lets a user submit categorized feedback to RecallMate support', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
    render(<HelpPage />)
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Calendar suggestion' } })
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Please add a weekly calendar view.' } })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/support', expect.objectContaining({ method: 'POST' })))
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload).toMatchObject({ type: 'feedback', subject: 'Calendar suggestion' })
    expect(await screen.findByText(/sent to RecallMate support/i)).toBeTruthy()
  })

  it('labels reports separately from feedback', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
    render(<HelpPage />)
    fireEvent.click(screen.getByRole('button', { name: /report a problem/i }))
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Broken button' } })
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'The upload control does not open on mobile.' } })
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).type).toBe('report')
  })
})
