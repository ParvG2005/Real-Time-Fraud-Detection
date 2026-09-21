import asyncio
import time
from fastapi import WebSocket
from app.security import resolve_token


class EventHub:
    def __init__(self):
        self.clients = {}
        self.loop = None

    async def publish(self, event):
        for socket, expiry in list(self.clients.items()):
            try:
                if expiry < time.time():
                    await socket.close(code=4401)
                    self.clients.pop(socket, None)
                else:
                    await socket.send_json(event)
            except Exception:
                self.clients.pop(socket, None)

    def notify(self, kind, transaction_id=None):
        if self.loop:
            asyncio.run_coroutine_threadsafe(
                self.publish(
                    dict(
                        type=kind,
                        transactionId=str(transaction_id) if transaction_id else None,
                    )
                ),
                self.loop,
            )

    async def connect(self, socket: WebSocket):
        await socket.accept()
        try:
            message = await asyncio.wait_for(socket.receive_json(), timeout=5)
            user = await asyncio.to_thread(resolve_token, message.get("token", ""))
            self.clients[socket] = user["expiresAt"]
            await socket.send_json({"type": "connected"})
            while True:
                await asyncio.wait_for(socket.receive_text(), timeout=45)
                if user["expiresAt"] < time.time():
                    break
                await socket.send_json({"type": "pong"})
        except Exception:
            pass
        finally:
            self.clients.pop(socket, None)
            try:
                await socket.close()
            except Exception:
                pass


hub = EventHub()
