
```ts
// Function
import { getStore } from "@netlify/blobs";
import { Context } from "@netlify/functions";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  // ... up to 20 custom fields
  [key: string]: any;
}

export default async (request: Request, context: Context) => {
  const store = getStore("calendar-data");
  const method = request.method;

  // GET: Fetch all calendar events
  if (method === "GET") {
    // Read the existing array, default to empty array if it doesn't exist
    const events = (await store.getJSON<CalendarEvent[]>("all_events")) || [];
    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST: Add or update an event
  if (method === "POST") {
    try {
      const payload = await request.json();
      const currentEvents = (await store.getJSON<CalendarEvent[]>("all_events")) || [];

      let updatedEvents: CalendarEvent[];

      if (payload.id) {
        // If an ID exists, find and update the existing event
        const index = currentEvents.findIndex(e => e.id === payload.id);
        if (index !== -1) {
          currentEvents[index] = { ...currentEvents[index], ...payload };
          updatedEvents = currentEvents;
        } else {
          // If ID provided but not found, treat as new
          updatedEvents = [...currentEvents, payload];
        }
      } else {
        // New event without an ID: generate one and append
        const newEvent = { ...payload, id: crypto.randomUUID() };
        
        // Enforce your "100 events tops" rule
        if (currentEvents.length >= 100) {
          return new Response("Storage limit reached (Max 100 events)", { status: 400 });
        }
        
        updatedEvents = [...currentEvents, newEvent];
      }

      // Overwrite the blob with the updated array
      await store.setJSON("all_events", updatedEvents);

      return new Response(JSON.stringify({ success: true, data: updatedEvents }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response("Invalid JSON payload", { status: 400 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

// Client
async function loadCalendar() {
  const response = await fetch('/.netlify/functions/calendar');
  const events = await response.json();
  console.log("Your 100 events:", events);
  return events;
}

async function saveEvent(eventData) {
  // eventData is an object containing your ~20 form fields
  const response = await fetch('/.netlify/functions/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData)
  });

  if (!response.ok) {
    const errorMsg = await response.text();
    alert(`Failed to save: ${errorMsg}`);
    return;
  }

  const result = await response.json();
  console.log("Updated calendar state:", result.data);
}
```