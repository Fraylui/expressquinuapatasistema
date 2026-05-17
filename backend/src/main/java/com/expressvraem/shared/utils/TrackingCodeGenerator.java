package com.expressvraem.shared.utils;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Year;
import java.util.concurrent.atomic.AtomicLong;

@Component
@RequiredArgsConstructor
@Slf4j
public class TrackingCodeGenerator {

    private final JdbcTemplate jdbcTemplate;
    private final AtomicLong secuencia = new AtomicLong(0);

    @PostConstruct
    public void inicializar() {
        try {
            Long maxId = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(MAX(id), 0) FROM encomiendas", Long.class);
            secuencia.set(maxId != null ? maxId : 0);
            log.info("TrackingCodeGenerator inicializado en: {}", secuencia.get());
        } catch (Exception e) {
            log.warn("No se pudo inicializar secuencia de tracking: {}", e.getMessage());
        }
    }

    public String generateCode() {
        long seq = secuencia.incrementAndGet();
        int year = Year.now().getValue();
        return String.format("EXP-%d-%05d", year, seq);
    }
}
