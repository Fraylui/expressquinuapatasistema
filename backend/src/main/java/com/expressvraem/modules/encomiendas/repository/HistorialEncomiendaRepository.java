package com.expressvraem.modules.encomiendas.repository;

import com.expressvraem.modules.encomiendas.entity.HistorialEncomienda;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HistorialEncomiendaRepository extends JpaRepository<HistorialEncomienda, Long> {
    List<HistorialEncomienda> findByEncomiendaIdOrderByCreatedAtAsc(Long encomiendaId);
}
