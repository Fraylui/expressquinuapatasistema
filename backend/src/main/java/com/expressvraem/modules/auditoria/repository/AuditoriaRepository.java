package com.expressvraem.modules.auditoria.repository;

import com.expressvraem.modules.auditoria.entity.Auditoria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditoriaRepository extends JpaRepository<Auditoria, Long>, JpaSpecificationExecutor<Auditoria> {
    List<Auditoria> findByUsuarioId(Long usuarioId);
    List<Auditoria> findByModulo(String modulo);
    List<Auditoria> findByFechaBetween(LocalDateTime desde, LocalDateTime hasta);
    List<Auditoria> findByAccion(String accion);
    long countByAgenciaIdAndFechaAfter(Long agenciaId, LocalDateTime desde);
    long countByAgenciaIdAndFechaAfterAndAccion(Long agenciaId, LocalDateTime desde, String accion);
}
