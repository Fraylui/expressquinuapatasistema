package com.expressvraem.shared.email;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.username:noreply@expressquinuapata.com}")
    private String fromEmail;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void enviarCredenciales(String para, String nombre, String email, String password) {
        if (mailHost == null || mailHost.isBlank()) {
            log.info("Email no configurado — saltando envío de credenciales a {}", email);
            return;
        }
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromEmail);
            msg.setTo(para);
            msg.setSubject("Bienvenido al sistema Express Quinuapata VRAEM — Credenciales de acceso");
            msg.setText(
                "Estimado/a " + nombre + ",\n\n" +
                "Se ha creado su cuenta en el sistema de gestión Express Quinuapata VRAEM S.A.C.\n\n" +
                "Sus credenciales de acceso temporales son:\n" +
                "  Email:      " + email + "\n" +
                "  Contraseña: " + password + "\n\n" +
                "Por seguridad, cambie su contraseña después del primer inicio de sesión.\n\n" +
                "Ingrese en: http://sistema.expressquinuapata.com\n\n" +
                "Saludos,\nExpress Quinuapata VRAEM S.A.C."
            );
            mailSender.send(msg);
            log.info("Credenciales enviadas a {}", para);
        } catch (Exception e) {
            log.warn("No se pudo enviar email de credenciales a {}: {}", para, e.getMessage());
        }
    }
}
