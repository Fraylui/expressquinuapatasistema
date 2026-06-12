package com.expressvraem.modules.auth.service;

import com.expressvraem.modules.auditoria.entity.Auditoria;
import com.expressvraem.modules.auditoria.service.AuditoriaService;
import com.expressvraem.modules.auth.entity.Usuario;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Persistencia de intentos fallidos de login en transacción propia.
 *
 * AuthService.login es @Transactional y lanza BusinessException inmediatamente
 * después de registrar el intento fallido: si el contador se guardara en esa
 * misma transacción, el rollback lo borraría y la cuenta nunca se bloquearía.
 * REQUIRES_NEW garantiza que el contador y la auditoría queden confirmados
 * aunque el login termine en excepción.
 */
@Service
@RequiredArgsConstructor
public class LoginAttemptService {

    private final UsuarioRepository usuarioRepository;
    private final AuditoriaService auditoriaService;

    public static final int  MAX_INTENTOS    = 5;
    public static final long BLOQUEO_MINUTOS = 30;

    /** Incrementa el contador (y bloquea al llegar al máximo). Devuelve el total acumulado. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int registrarIntentoFallido(Long usuarioId) {
        Usuario usuario = usuarioRepository.findById(usuarioId).orElse(null);
        if (usuario == null) return 0;
        int intentos = usuario.getIntentosFallidos() + 1;
        usuario.setIntentosFallidos(intentos);
        if (intentos >= MAX_INTENTOS) {
            usuario.setBloqueadoHasta(LocalDateTime.now().plusMinutes(BLOQUEO_MINUTOS));
        }
        usuarioRepository.save(usuario);
        return intentos;
    }

    // Sin try/catch interno: si el insert falla, la transacción nueva debe
    // abortar limpia (capturar aquí dejaría la tx marcada rollback-only y el
    // commit del interceptor lanzaría UnexpectedRollbackException al login).
    // El llamador (AuthService.auditLoginFallido) captura la excepción.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void auditarLoginFallido(String email, Long agenciaId, String ip, String motivo) {
        auditoriaService.registrar(Auditoria.builder()
                .usuarioNombre(email)
                .agenciaId(agenciaId)
                .accion("LOGIN_FALLIDO")
                .modulo("AUTH").entidad("SESION")
                .datosDespues("motivo=" + motivo)
                .ip(ip).build());
    }
}
