package com.expressvraem.modules.encomiendas.repository;

import com.expressvraem.modules.encomiendas.entity.HistorialEncomienda;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HistorialEncomiendaRepository extends JpaRepository<HistorialEncomienda, Long> {
    List<HistorialEncomienda> findByEncomiendaIdOrderByCreatedAtAsc(Long encomiendaId);

    java.util.Optional<HistorialEncomienda> findFirstByEncomiendaIdAndEstadoNuevoOrderByCreatedAtDesc(
            Long encomiendaId, String estadoNuevo);
}
