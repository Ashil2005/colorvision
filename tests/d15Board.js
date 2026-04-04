import { caps, correctOrder } from './d15Config.js';

const capMap = new Map(caps.map((cap) => [cap.id, cap]));

export function createShuffledD15Order() {
    const nextOrder = correctOrder.slice();

    for (let index = nextOrder.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [nextOrder[index], nextOrder[swapIndex]] = [nextOrder[swapIndex], nextOrder[index]];
    }

    return nextOrder;
}

function reorderCaps(order, draggedId, targetId) {
    const nextOrder = order.slice();
    const draggedIndex = nextOrder.indexOf(draggedId);
    const targetIndex = nextOrder.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
        return nextOrder;
    }

    const [draggedCap] = nextOrder.splice(draggedIndex, 1);
    nextOrder.splice(targetIndex, 0, draggedCap);
    return nextOrder;
}

export function renderD15Board(container, order, options = {}) {
    if (!container) return;

    const { onReorder } = options;
    let draggingId = null;

    container.innerHTML = '';

    const board = document.createElement('div');
    board.className = 'd15-caps caps-container';

    // Separate first cap and movable caps
    const fixedCap = order[0];
    const movableCaps = order.slice(1);

    // Render fixed cap
    if (fixedCap) {
        const cap = capMap.get(fixedCap);
        if (cap) {
            const capButton = document.createElement('button');
            capButton.type = 'button';
            capButton.className = 'd15-cap cap fixed-cap';
            capButton.draggable = false;
            capButton.dataset.capId = String(cap.id);
            capButton.title = `Cap ${cap.id} (Fixed)`;
            capButton.setAttribute('aria-label', `D-15 cap ${cap.id} - Fixed reference`);
            capButton.style.background = cap.color;
            capButton.style.borderColor = 'rgba(255, 255, 255, 0.35)';
            capButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
            capButton.style.cursor = 'default';
            board.appendChild(capButton);
        }
    }

    // Draggable divider
    const divider = document.createElement('div');
    divider.style.width = '2px';
    divider.style.height = '80px';
    divider.style.background = 'rgba(255, 255, 255, 0.2)';
    divider.style.margin = '0 8px';
    board.appendChild(divider);

    // Render movable caps
    const draggableContainer = document.createElement('div');
    draggableContainer.className = 'draggable-caps';
    draggableContainer.style.display = 'flex';
    draggableContainer.style.gap = '12px';
    draggableContainer.style.flexWrap = 'nowrap';

    movableCaps.forEach((capId) => {
        const cap = capMap.get(capId);
        if (!cap) return;

        const capButton = document.createElement('button');
        capButton.type = 'button';
        capButton.className = 'd15-cap cap';
        capButton.draggable = true;
        capButton.dataset.capId = String(cap.id);
        capButton.title = `Cap ${cap.id}`;
        capButton.setAttribute('aria-label', `D-15 cap ${cap.id}`);
        capButton.style.background = cap.color;
        capButton.style.borderColor = 'rgba(255, 255, 255, 0.35)';
        capButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';

        capButton.addEventListener('dragstart', (event) => {
            draggingId = cap.id;
            capButton.style.opacity = '0.45';
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', String(cap.id));
            }
        });

        capButton.addEventListener('dragend', () => {
            draggingId = null;
            capButton.style.opacity = '1';
        });

        capButton.addEventListener('dragover', (event) => {
            event.preventDefault();
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'move';
            }
        });

        capButton.addEventListener('drop', (event) => {
            event.preventDefault();
            const droppedId = draggingId ?? Number(event.dataTransfer?.getData('text/plain'));
            if (!droppedId || droppedId === cap.id || typeof onReorder !== 'function') {
                return;
            }

            // Only reorder within movable caps
            const movableOrder = reorderCaps(movableCaps, droppedId, cap.id);
            const nextOrder = [fixedCap, ...movableOrder];
            onReorder(nextOrder);
        });

        draggableContainer.appendChild(capButton);
    });

    board.appendChild(draggableContainer);
    container.appendChild(board);
}
