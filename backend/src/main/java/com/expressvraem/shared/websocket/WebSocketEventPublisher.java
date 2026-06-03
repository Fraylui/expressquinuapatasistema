package com.expressvraem.shared.websocket;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WebSocketEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public void publicarActualizacionAsientos(Long viajeId, Object dto) {
        messagingTemplate.convertAndSend("/topic/asientos/" + viajeId, dto);
    }

    public void publicarCambioEstadoEncomienda(String codigo, Object dto) {
        messagingTemplate.convertAndSend("/topic/encomiendas/" + codigo, dto);
    }

    public void publicarMovimientoCaja(Long cajaId, Object dto) {
        messagingTemplate.convertAndSend("/topic/caja/" + cajaId, dto);
    }

    public void publicarNotificacion(Long usuarioId, Object dto) {
        messagingTemplate.convertAndSend("/queue/notificaciones/" + usuarioId, dto);
    }

    public void publicarEncomiendaEnCamino(Long agenciaDestinoId, Object dto) {
        messagingTemplate.convertAndSend("/topic/encomiendas/agencia/" + agenciaDestinoId, dto);
    }
}
