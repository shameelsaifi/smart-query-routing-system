import { useEffect, useState } from 'react'
import { getAssignedTickets, resolveTicket, startTicket } from '../services/ticketService'

// Shared data and actions for Fee & Billing, Scholarship, and Refunds pages.
export function useAssignedTickets(accessToken) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [startingTicket, setStartingTicket] = useState(null)
  const [resolvingTicket, setResolvingTicket] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getAssignedTickets(accessToken, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setTickets(data)
        setErrorMessage('')
      })
      .catch((error) => {
        if (!controller.signal.aborted) setErrorMessage(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [accessToken])

  const loadTickets = async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      setTickets(await getAssignedTickets(accessToken))
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const updateTicket = async (ticketNumber, action) => {
    const starting = action === 'start'
    const setBusy = starting ? setStartingTicket : setResolvingTicket
    setBusy(ticketNumber)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const request = starting ? startTicket : resolveTicket
      const data = await request(accessToken, ticketNumber)
      setTickets((current) => current.map((ticket) =>
        (ticket.ticket_number || ticket.ticket_code) === ticketNumber
          ? { ...ticket, status: data.status || (starting ? 'IN_PROGRESS' : 'RESOLVED') }
          : ticket,
      ))
      setSuccessMessage(starting
        ? `Ticket ${ticketNumber} is now in progress.`
        : `Ticket ${ticketNumber} has been resolved successfully.`)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setBusy(null)
    }
  }

  return {
    tickets, loading, startingTicket, resolvingTicket, errorMessage, successMessage,
    loadTickets,
    handleStartWork: (ticketNumber) => updateTicket(ticketNumber, 'start'),
    handleResolveTicket: (ticketNumber) => updateTicket(ticketNumber, 'resolve'),
  }
}
