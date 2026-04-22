from flask import Flask, render_template, request, jsonify
from collections import deque
import heapq
import time

app = Flask(__name__)

# ── Data Structures ──────────────────────────────────────────────────────────
normal_queue = deque()        # Queue  (FIFO)
vip_queue = []                # Priority Queue  (min-heap by priority counter)
history_stack = []            # Stack  (LIFO – processed orders)
order_lookup = {}             # Hash Table  (order_id → order details)

vip_counter = 0               # Tie-breaker so heapq stays stable
processing_log = []           # Step-by-step log shown on the UI


# ── Helpers ──────────────────────────────────────────────────────────────────
def _snapshot():
    """Return the current state of every data structure."""
    return {
        "normalQueue":  [order_lookup[oid] for oid in normal_queue],
        "vipQueue":     [order_lookup[item[1]] for item in vip_queue],
        "historyStack": [order_lookup[oid] for oid in history_stack],
        "log":          processing_log[-30:],   # last 30 entries
    }


# ── Routes ───────────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/add_order", methods=["POST"])
def add_order():
    global vip_counter
    data = request.json

    order_id     = data.get("orderId", "").strip()
    customer     = data.get("customerName", "").strip()
    order_type   = data.get("type", "normal")

    if not order_id:
        return jsonify({"error": "Order ID is required"}), 400
    if not customer:
        return jsonify({"error": "Customer Name is required"}), 400
    if order_id in order_lookup:
        return jsonify({"error": f"Order ID '{order_id}' already exists"}), 400

    order = {
        "id":        order_id,
        "customer":  customer,
        "type":      order_type,
        "status":    "queued",
        "timestamp": time.strftime("%H:%M:%S"),
    }

    # Store in Hash Table
    order_lookup[order_id] = order

    if order_type == "vip":
        heapq.heappush(vip_queue, (vip_counter, order_id))
        vip_counter += 1
        ds_used = "Priority Queue (Min-Heap)"
        processing_log.append(
            f"[+VIP]  Order {order_id} ({customer}) → Priority Queue  ⏱ {order['timestamp']}"
        )
    else:
        normal_queue.append(order_id)
        ds_used = "Queue (FIFO – deque)"
        processing_log.append(
            f"[+ORD]  Order {order_id} ({customer}) → Normal Queue  ⏱ {order['timestamp']}"
        )

    return jsonify({
        "message": f"Order {order_id} added",
        "dsUsed": ds_used,
        **_snapshot(),
    })


@app.route("/process_order", methods=["POST"])
def process_order():
    order_id = None
    ds_used = ""

    if vip_queue:
        _, order_id = heapq.heappop(vip_queue)
        ds_used = "Priority Queue (Min-Heap) → heappop"
    elif normal_queue:
        order_id = normal_queue.popleft()
        ds_used = "Queue (FIFO) → popleft"
    else:
        return jsonify({"error": "No orders to process"}), 400

    order_lookup[order_id]["status"] = "processed"
    history_stack.append(order_id)

    processing_log.append(
        f"[✓ PROC]  Order {order_id} processed using {ds_used}  ⏱ {time.strftime('%H:%M:%S')}"
    )

    return jsonify({
        "message": f"Order {order_id} processed",
        "processed": order_lookup[order_id],
        "dsUsed": ds_used,
        **_snapshot(),
    })


@app.route("/undo", methods=["POST"])
def undo():
    global vip_counter

    if not history_stack:
        return jsonify({"error": "Nothing to undo"}), 400

    order_id = history_stack.pop()
    order = order_lookup[order_id]
    order["status"] = "queued"

    # Return to the correct queue
    if order["type"] == "vip":
        heapq.heappush(vip_queue, (vip_counter, order_id))
        vip_counter += 1
        ds_used = "Stack (pop) → Priority Queue (push)"
    else:
        normal_queue.appendleft(order_id)
        ds_used = "Stack (pop) → Queue (appendleft)"

    processing_log.append(
        f"[↩ UNDO]  Order {order_id} restored using {ds_used}  ⏱ {time.strftime('%H:%M:%S')}"
    )

    return jsonify({
        "message": f"Order {order_id} restored",
        "dsUsed": ds_used,
        **_snapshot(),
    })


@app.route("/lookup/<order_id>")
def lookup(order_id):
    order = order_lookup.get(order_id)
    if order:
        processing_log.append(
            f"[🔍 FIND]  Looked up Order {order_id} via Hash Table  ⏱ {time.strftime('%H:%M:%S')}"
        )
        return jsonify({"order": order, "dsUsed": "Hash Table (dict) – O(1) lookup"})
    return jsonify({"error": f"Order '{order_id}' not found"}), 404


@app.route("/status")
def status():
    """Return a full snapshot (used for initial page load / polling)."""
    return jsonify(_snapshot())


if __name__ == "__main__":
    app.run(debug=True)