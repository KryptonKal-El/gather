# dnd-kit Conventions

Applies to any drag-and-drop implementation in the React app.

## Library

Use `@dnd-kit/core` and `@dnd-kit/sortable`. Do not introduce other drag-and-drop libraries.

## Sensor Configuration

Always configure both pointer and touch sensors with the exact settings below:

```js
import { useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import { KeyboardSensor, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);
```

- `distance: 8` on pointer prevents accidental drags when clicking.
- `delay: 250, tolerance: 5` on touch provides a deliberate long-press activation.

## Sortable List Pattern

```jsx
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

function SortableList({ items, onReorder }) {
  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {items.map(item => <SortableItem key={item.id} item={item} />)}
      </SortableContext>
    </DndContext>
  );
}
```

## Sortable Item Pattern

```jsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ item }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {item.name}
    </div>
  );
}
```

## Modifiers

- Always apply `restrictToVerticalAxis` for list reordering. This prevents horizontal drift during a drag.

## Reorder Persistence

After `arrayMove`, persist the new order to Supabase. Compute new `sortOrder` values from the reordered array index before writing (use RPC or batch update as appropriate).
